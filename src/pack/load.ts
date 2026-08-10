/**
 * 온보딩 카드덱(팩) 로더. 데이터베이스 없이 JSON 파일에서 바로 읽습니다.
 * 데이터베이스 도입 시점과 이유: docs/decisions/0001-defer-database.md
 *
 * packs/<id>/pack.json + cards.json + field-matrix.json 을 읽어
 * 한국어 축·트랙 값을 영어 열거값으로 정규화하고(docs/decisions/0003-english-storage-korean-ui.md),
 * 화면이 보기 전에 팩의 무결성을 검사합니다. 어긴 항목은 전부 모아 한 번에 오류로 알립니다.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { ALLOWED_BODY_TAGS, CARD_AXIS_FROM_KO, TRACK_FROM_KO, disallowedBodyMarkup } from "../domain/pack.ts";
import type {
  Card,
  CardTerm,
  FieldMatrix,
  FieldOption,
  Pack,
  PackMeta,
  ValueChainPosition,
} from "../domain/pack.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..");
export const PACKS_DIR = join(REPO_ROOT, "packs");

/** cards.json 의 원본 형태. 사람이 손으로 쓰는 파일이라 짧은 키를 씁니다. */
interface RawCard {
  id: string;
  track: string;
  title: string;
  minutes: number;
  lead: string;
  axis: string;
  body: string;
  audit: string;
  terms?: { t: string; d: string }[];
  next?: { q: string; to: string }[];
}

/**
 * pack.json 의 원본 형태(docs/pack-authoring.md, packs/_template/pack.json).
 * 팩 작성 파이프라인이 만드는 파일이므로 화면이 그 형식을 따라갑니다.
 * 화면 전용 값(title, entry_card 등)은 적혀 있으면 쓰고, 없으면 이 로더가 정합니다.
 */
interface RawPackMeta {
  id?: string;
  industry?: string;
  sources?: { id: string; title: string; type: string; grade: string }[];
  date_range?: { from: string; to: string };
  date_clusters?: { from: string; to: string; sources: string[] }[];
  positions?: (string | { id?: string; label?: string; note?: string })[];
  fields?: (string | { id?: string; label?: string; card?: string })[];
  known_limits?: string[];
  /** 아래는 화면 전용. 없으면 기본값을 씁니다. */
  title?: string;
  subtitle?: string;
  entry_card?: string;
  search_note?: string;
}

/**
 * field-matrix.json 의 원본 형태. 이 파일은 (개념 × 위치 × 필드) 판정표이고,
 * 화면은 그중 positions·fields 만 씁니다. 아직 만들어지지 않은 팩도 있으므로 없어도 됩니다.
 * 담당 필드와 카드의 연결은 card_by_field 로 적을 수 있고, 없으면 필드 트랙 카드에서 찾습니다.
 */
interface RawFieldMatrix {
  positions?: (string | { id?: string; label?: string; note?: string })[];
  fields?: (string | { id?: string; label?: string; card?: string })[];
  card_by_field?: Record<string, string>;
  always_cards?: string[];
  note?: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function packDir(id: string): string {
  return join(PACKS_DIR, id);
}

/**
 * pack.json 과 cards.json 이 모두 있는 폴더만 팩으로 봅니다.
 * 밑줄로 시작하는 폴더(packs/_template)는 자리표시자이므로 건너뜁니다.
 */
export function listPackIds(): string[] {
  if (!existsSync(PACKS_DIR)) return [];
  return readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name)
    .filter((id) => existsSync(join(packDir(id), "pack.json")) && existsSync(join(packDir(id), "cards.json")))
    .sort();
}

/**
 * 팩 하나를 읽어 검증까지 마칩니다.
 * 검증을 통과하지 못하면 무엇이 몇 번 카드에서 잘못됐는지 전부 적어 throw 합니다.
 */
export function loadPack(id: string): Pack {
  const dir = packDir(id);
  for (const file of ["pack.json", "cards.json"]) {
    if (!existsSync(join(dir, file))) {
      throw new Error(`팩 "${id}" 에 ${file} 이(가) 없습니다: ${join(dir, file)}`);
    }
  }

  const rawMeta = readJson<RawPackMeta>(join(dir, "pack.json"));
  const rawCards = readJson<RawCard[]>(join(dir, "cards.json"));
  const matrixPath = join(dir, "field-matrix.json");
  const rawMatrix = existsSync(matrixPath) ? readJson<RawFieldMatrix>(matrixPath) : undefined;

  if (!Array.isArray(rawCards)) {
    throw new Error(`팩 "${id}" 의 cards.json 은 카드 배열이어야 합니다.`);
  }

  /* 자리표시자 주석만 있는 항목은 카드가 아닙니다(packs/_template/cards.json 참조). */
  const cards = rawCards
    .filter((raw) => typeof raw.id === "string" && raw.id.length > 0)
    .map((raw, index) => normalizeCard(id, raw, index));

  const meta = normalizeMeta(id, rawMeta, cards);
  const fieldMatrix = normalizeFieldMatrix(id, rawMatrix, rawMeta, cards);

  validatePack(id, meta, cards, fieldMatrix);
  return { meta, cards, fieldMatrix };
}

/** 팩 전부. 하나라도 검증에 실패하면 그 팩의 오류를 그대로 올립니다. */
export function loadAllPacks(): Pack[] {
  return listPackIds().map((id) => loadPack(id));
}

function normalizeCard(packId: string, raw: RawCard, index: number): Card {
  const where = raw.id ? `카드 ${raw.id}` : `${index + 1}번째 카드`;

  const track = TRACK_FROM_KO[raw.track];
  if (!track) {
    throw new Error(
      `팩 "${packId}" ${where}: 모르는 track "${raw.track}". ` +
        `쓸 수 있는 값: ${Object.keys(TRACK_FROM_KO).join(", ")}`,
    );
  }

  const axis = CARD_AXIS_FROM_KO[raw.axis];
  if (!axis) {
    throw new Error(
      `팩 "${packId}" ${where}: 모르는 axis "${raw.axis}". ` +
        `쓸 수 있는 값: ${Object.keys(CARD_AXIS_FROM_KO).join(", ")}`,
    );
  }

  const terms: CardTerm[] = (raw.terms ?? []).map((t) => ({ term: t.t, definition: t.d }));
  const next = (raw.next ?? []).map((n) => ({ question: n.q, to: n.to }));

  return {
    id: raw.id,
    track,
    title: raw.title,
    minutes: typeof raw.minutes === "number" ? raw.minutes : 3,
    lead: raw.lead ?? "",
    axis,
    body: raw.body ?? "",
    audit: raw.audit ?? "",
    terms,
    next,
  };
}

/** 화면 머리말과 꼬리말. pack.json 에 적혀 있으면 그 값을, 없으면 팩 작성 결과에서 만듭니다. */
function normalizeMeta(id: string, raw: RawPackMeta, cards: Card[]): PackMeta {
  const sources = raw.sources ?? [];
  const types = [...new Set(sources.map((s) => s.type).filter(Boolean))];
  const grades = [...new Set(sources.map((s) => s.grade).filter(Boolean))].sort();
  const range = raw.date_range;

  const basis =
    sources.length > 0
      ? `${types.join("·")} ${sources.length}건에서 만든 산업 일반론입니다(출처 등급 ${grades.join("·")})`
      : "산업 자료에서 만든 산업 일반론입니다";

  /* 시점이 몰린 덩어리를 그대로 보여 줍니다. 덩어리 사이의 차이는 상충이 아니라 변화입니다. */
  const clusters = (raw.date_clusters ?? [])
    .map((c) => (c.from === c.to ? c.from : `${c.from} ~ ${c.to}`))
    .join(" / ");
  const asOf = clusters ? `자료 시점은 ${clusters} 두 덩어리로 나뉩니다.` : "";

  return {
    id: raw.id ?? id,
    industry: raw.industry ?? id,
    title: raw.title ?? "감사 투입 전 온보딩",
    subtitle:
      raw.subtitle ??
      "회사와 담당 필드를 알려주시면, 그 필드에 필요한 만큼만 열어드립니다. 한 번에 3~5분 분량입니다.",
    entryCardId: raw.entry_card ?? (cards[0] ? cards[0].id : ""),
    source: {
      basis,
      collectedRange: range ? `${range.from} ~ ${range.to}` : "",
      asOf,
      limitation:
        "1차 공시가 아니므로 감사 판단의 근거가 아니라 합리성 검증의 기준선으로만 쓰십시오. " +
        "이 팩의 어떤 문장도 특정 회사의 사실로 쓸 수 없습니다.",
      limits: raw.known_limits ?? [],
    },
    searchNote:
      raw.search_note ??
      "카드 안에서 찾는 로컬 키워드 검색입니다. 카드에 없는 답을 새로 만들려면 모델 API 연결이 필요합니다.",
  };
}

/** 문자열 또는 객체로 적힌 선택지를 하나의 형태로 폅니다. */
function optionOf(value: string | { id?: string; label?: string }): { id: string; label: string } {
  if (typeof value === "string") return { id: value, label: value };
  const label = value.label ?? value.id ?? "";
  return { id: value.id ?? label, label };
}

/** 비교용 정규화. "전반(인차지)" 와 "전반 / 인차지" 를 같은 것으로 봅니다. */
function normalizeLabel(value: string): string {
  return value.replace(/[\s()[\]/·,~—-]/g, "");
}

/**
 * 시작 화면의 밸류체인 위치·담당 필드.
 * field-matrix.json 이 있으면 그 값을, 없으면 pack.json 의 positions·fields 를 씁니다.
 * 담당 필드가 어느 카드로 이어지는지는 필드 트랙 카드의 제목에서 찾습니다.
 */
function normalizeFieldMatrix(
  packId: string,
  raw: RawFieldMatrix | undefined,
  rawMeta: RawPackMeta,
  cards: Card[],
): FieldMatrix {
  const rawPositions = raw?.positions ?? rawMeta.positions ?? [];
  const rawFields = raw?.fields ?? rawMeta.fields ?? [];
  const limits = rawMeta.known_limits ?? [];

  /* 위치별 안내문은 팩이 스스로 적어 둔 한계에서 가져옵니다(예: 해운사 트랙 미구축). */
  const positions: ValueChainPosition[] = rawPositions.map((value) => {
    const option = optionOf(value);
    const note =
      (typeof value === "object" && value.note) || limits.find((limit) => limit.includes(option.label)) || "";
    return { id: option.id, label: option.label, note };
  });

  const fieldCards = cards.filter((c) => c.track === "FIELD");
  const wrapCards = cards.filter((c) => c.track === "WRAP_UP");
  const taken = new Set<string>();

  const fields: FieldOption[] = rawFields.map((value) => {
    const option = optionOf(value);
    const explicit =
      (typeof value === "object" && value.card) || (raw?.card_by_field ?? {})[option.label] || "";

    let cardId = explicit;
    if (!cardId) {
      /* 제목으로 찾고, 못 찾으면 남은 필드 트랙 카드를, 그마저 없으면 마무리 카드를 씁니다. */
      const key = normalizeLabel(option.label);
      const match = fieldCards.find((c) => !taken.has(c.id) && normalizeLabel(c.title).includes(key));
      const leftover = fieldCards.find((c) => !taken.has(c.id));
      cardId = (match ?? leftover ?? wrapCards[0])?.id ?? "";
    }
    if (cardId) taken.add(cardId);

    if (!cardId) {
      throw new Error(
        `팩 "${packId}": 담당 필드 "${option.label}" 에 이어질 카드를 찾지 못했습니다. ` +
          `field-matrix.json 에 card_by_field 로 카드 id 를 적어 주십시오.`,
      );
    }
    return { id: option.id, label: option.label, card: cardId };
  });

  return {
    positions,
    fields,
    alwaysCards: raw?.always_cards ?? wrapCards.map((c) => c.id),
    note: raw?.note ?? "",
  };
}

/**
 * 화면이 팩을 보기 전에 거는 검사.
 * 어긴 항목을 모두 모아 한 번에 알립니다. 하나씩 고치고 다시 빌드하는 일을 줄이기 위해서입니다.
 */
export function validatePack(id: string, meta: PackMeta, cards: Card[], fieldMatrix: FieldMatrix): void {
  const problems: string[] = [];

  if (cards.length === 0) problems.push("카드가 한 장도 없습니다.");

  /* 1. id 중복 */
  const seen = new Set<string>();
  for (const card of cards) {
    if (!card.id) {
      problems.push("id 가 없는 카드가 있습니다.");
      continue;
    }
    if (seen.has(card.id)) problems.push(`카드 id 가 중복입니다: ${card.id}`);
    seen.add(card.id);
  }

  /* 2. 이어서 볼 것 링크가 전부 존재하는지 */
  for (const card of cards) {
    for (const link of card.next) {
      if (!seen.has(link.to)) {
        problems.push(`카드 ${card.id} 의 "이어서 볼 것" 링크가 없는 카드를 가리킵니다: ${link.to}`);
      }
    }
  }

  /* 3. 본문 허용 태그·속성 */
  for (const card of cards) {
    for (const problem of disallowedBodyMarkup(card.body)) {
      problems.push(`카드 ${card.id} 본문: ${problem}`);
    }
  }

  /* 4. 감사 연결 문장은 비어 있을 수 없음 */
  for (const card of cards) {
    if (!card.audit.trim()) {
      problems.push(`카드 ${card.id} 에 "이걸 알면 무엇이 달라지나"(audit) 가 비어 있습니다.`);
    }
  }

  /* 5. 시작 카드와 필드 표가 실제 카드를 가리키는지 */
  if (!seen.has(meta.entryCardId)) {
    problems.push(`pack.json 의 entry_card 가 없는 카드를 가리킵니다: ${meta.entryCardId}`);
  }
  for (const field of fieldMatrix.fields) {
    if (!seen.has(field.card)) {
      problems.push(`field-matrix.json 의 필드 "${field.label}" 가 없는 카드를 가리킵니다: ${field.card}`);
    }
  }
  for (const cardId of fieldMatrix.alwaysCards) {
    if (!seen.has(cardId)) {
      problems.push(`field-matrix.json 의 always_cards 가 없는 카드를 가리킵니다: ${cardId}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `팩 "${id}" 검증 실패 — ${problems.length}건\n` +
        problems.map((p) => `  - ${p}`).join("\n") +
        `\n본문에 쓸 수 있는 태그: ${ALLOWED_BODY_TAGS.join(", ")} (속성은 쓸 수 없습니다)`,
    );
  }

  /* 경고: 오류는 아니지만 사람이 봐야 합니다. 시작 카드는 유입이 없어도 정상입니다. */
  for (const cardId of orphanCardIds(meta, cards, fieldMatrix)) {
    console.warn(`팩 "${id}" 경고: 카드 ${cardId} 로 들어오는 링크가 없습니다. 목차로만 닿습니다.`);
  }
}

/** 유입 링크가 0인 카드. 시작 카드와 필드 표에서 여는 카드는 제외합니다. */
export function orphanCardIds(meta: PackMeta, cards: Card[], fieldMatrix?: FieldMatrix): string[] {
  const incoming = new Map<string, number>(cards.map((c) => [c.id, 0]));
  for (const card of cards) {
    for (const link of card.next) {
      incoming.set(link.to, (incoming.get(link.to) ?? 0) + 1);
    }
  }

  const entries = new Set<string>([meta.entryCardId]);
  for (const field of fieldMatrix?.fields ?? []) entries.add(field.card);
  for (const cardId of fieldMatrix?.alwaysCards ?? []) entries.add(cardId);

  return [...incoming.entries()]
    .filter(([cardId, count]) => count === 0 && !entries.has(cardId))
    .map(([cardId]) => cardId);
}
