/**
 * 온보딩 카드덱(팩)의 도메인 타입과 화면 표기.
 *
 * 저장은 영어, 화면 표기는 한국어입니다(docs/decisions/0003-english-storage-korean-ui.md).
 * packs/<id>/cards.json 은 사람이 쓰기 쉽도록 한국어 축·트랙 값을 그대로 두고,
 * 로더(src/pack/load.ts)가 이 파일의 대응표로 영어 열거값으로 정규화합니다.
 * 화면과 테스트는 언제나 정규화된 값만 봅니다.
 */

import type { AssertionStatus, Scope } from "./types.ts";

/**
 * 카드가 서 있는 축.
 * 세 값 모두 산업 자료에서 온 것이며, 어느 것도 회사 특정 사실(FACT)이 아닙니다.
 * - INDUSTRY: 업계 일반론
 * - MIXED: 업계 일반론이지만 회사마다 달라지는 부분 → 이 회사가 그런지 확인 필요
 * - UNVERIFIED: 아직 모르는 것 → 요청자료·인터뷰 질문으로 전환
 */
export const CARD_AXIS = ["INDUSTRY", "MIXED", "UNVERIFIED"] as const;
export type CardAxis = (typeof CARD_AXIS)[number];

/** cards.json 의 한국어 axis 값 → 저장 열거값. 표에 없는 값은 로더가 오류로 막습니다. */
export const CARD_AXIS_FROM_KO: Record<string, CardAxis> = {
  산업: "INDUSTRY",
  산업일반: "INDUSTRY",
  "산업 일반": "INDUSTRY",
  혼합: "MIXED",
  미확인: "UNVERIFIED",
};

/**
 * 축 → 기존 도메인 열거값(src/domain/types.ts).
 * 카드는 Claim 이 아니지만 감사인이 읽는 방식은 같아야 하므로 같은 축으로 되돌립니다.
 * - INDUSTRY/MIXED: 산업 자료에서 도출한 것이므로 INDUSTRY + INFERENCE.
 *   산업 자료는 회사 특정 주장을 사실로 만들 수 없습니다(CLAUDE.md 도메인 규칙 4).
 * - MIXED 는 여기에 "회사 확인 필요" 표시를 더한 것입니다.
 * - UNVERIFIED: 회사에 대해 아직 아는 바가 없는 상태이므로 COMPANY + UNVERIFIED.
 *   빈칸을 조용히 채우지 않고 요청자료·질문으로 넘깁니다(CLAUDE.md 도메인 규칙 8).
 */
export const CARD_AXIS_CLAIM: Record<
  CardAxis,
  { scope: Scope; assertion: AssertionStatus; companyCheckRequired: boolean }
> = {
  INDUSTRY: { scope: "INDUSTRY", assertion: "INFERENCE", companyCheckRequired: false },
  MIXED: { scope: "INDUSTRY", assertion: "INFERENCE", companyCheckRequired: true },
  UNVERIFIED: { scope: "COMPANY", assertion: "UNVERIFIED", companyCheckRequired: true },
};

/** 화면 표기. 색만으로 상태를 구분하지 않기 위해 글자와 기호를 함께 둡니다(CLAUDE.md UI 규칙). */
export const CARD_AXIS_LABEL_KO: Record<CardAxis, { label: string; mark: string; hint: string }> = {
  INDUSTRY: {
    label: "산업 일반",
    mark: "◇",
    hint: "업계 일반론입니다. 이 회사에 그대로 적용되는지는 회사 자료로 확인해야 합니다.",
  },
  MIXED: {
    label: "확인 필요",
    mark: "◈",
    hint: "업계 일반론이지만 회사마다 달라지는 부분입니다. 이 회사가 그런지 확인하십시오.",
  },
  UNVERIFIED: {
    label: "미확인",
    mark: "?",
    hint: "아직 모르는 것입니다. 요청자료나 인터뷰 질문으로 전환합니다.",
  },
};

/** 트랙. 배열 순서가 곧 목차 표시 순서입니다. */
export const TRACK = [
  "INDUSTRY_BASICS",
  "BUSINESS",
  "TRANSACTION",
  "EQUIPMENT",
  "GLOSSARY",
  "FIELD",
  "WRAP_UP",
] as const;
export type Track = (typeof TRACK)[number];

/** cards.json 의 한국어 track 값 → 저장 열거값. */
export const TRACK_FROM_KO: Record<string, Track> = {
  산업기초: "INDUSTRY_BASICS",
  비즈니스: "BUSINESS",
  거래구조: "TRANSACTION",
  기자재: "EQUIPMENT",
  용어: "GLOSSARY",
  필드: "FIELD",
  마무리: "WRAP_UP",
};

export const TRACK_LABEL_KO: Record<Track, string> = {
  INDUSTRY_BASICS: "산업기초",
  BUSINESS: "비즈니스",
  TRANSACTION: "거래구조",
  EQUIPMENT: "기자재",
  GLOSSARY: "용어",
  FIELD: "필드",
  WRAP_UP: "마무리",
};

/** 목차 표시 순서. */
export const TRACK_ORDER: readonly Track[] = TRACK;

/** 목차에 넣지 않는 트랙. 담당 필드에 따라 "내 필드" 목록에 따로 나옵니다. */
export const TRACK_HIDDEN_IN_TOC: readonly Track[] = ["FIELD"];

/**
 * 본문에 허용하는 태그. 목록에 없는 태그와 **모든 속성**을 금지합니다.
 * 카드 본문은 사람이 쓴 HTML 조각이므로, 화면 CSS를 건드리는 class·style 이 섞이면
 * 팩마다 화면이 달라집니다. 서식은 전부 렌더러의 CSS가 정합니다.
 */
export const ALLOWED_BODY_TAGS: readonly string[] = [
  "p",
  "ul",
  "ol",
  "li",
  "b",
  "em",
  "table",
  "tr",
  "th",
  "td",
  "blockquote",
  "br",
];

/**
 * 카드 규격(docs/onboarding-deck-design.md §5). 검사 D4·D5·D7 이 이 값을 씁니다.
 * 한 장을 3~5분에 읽게 하는 것이 목적이므로 상한뿐 아니라 하한도 둡니다 —
 * 너무 짧은 카드는 게이트를 통과시키지 못한 채 장수만 늘립니다.
 */
export const BODY_TEXT_MIN = 800;
export const BODY_TEXT_MAX = 1400;

/** 카드당 표 개수 상한. "표가 두 개면 이미 두 카드다"(§5). */
export const TABLE_MAX = 1;

/** 표의 데이터 행 상한. 머리글 행(th 만 있는 첫 행)은 세지 않습니다. */
export const TABLE_DATA_ROW_MAX = 6;

/** "이어서 볼 것" 칩 개수. 목차가 아니라 궁금증이므로 좁게 잡습니다(§5). */
export const NEXT_MIN = 3;
export const NEXT_MAX = 4;

/** 용어 미니사전 개수. 그 카드에 처음 나온 것만(§5). */
export const TERMS_MIN = 2;
export const TERMS_MAX = 4;

/**
 * 조회용 카드의 트랙.
 *
 * §5 의 표 행수·용어 개수 규격은 "한 장에 한 논증"을 지키려는 것입니다.
 * 용어 트랙의 카드는 논증이 아니라 **찾아보는 표**여서 그 취지에 해당하지 않습니다.
 * 20개짜리 사전을 6행씩 네 장으로 쪼개면 찾는 일이 더 어려워집니다.
 * 그래서 이 트랙에 한해 행수 상한과 용어 개수 하한을 면제하되,
 * 표 개수 1개와 본문 길이 규격은 그대로 적용합니다.
 */
export const REFERENCE_TRACKS: readonly Track[] = ["GLOSSARY"];

/** 태그를 뺀 본문 길이. 화면과 테스트가 같은 함수를 씁니다. */
export function bodyTextLength(body: string): number {
  return body.replace(/<[^>]*>/g, "").trim().length;
}

/** 본문 안 표의 개수와, 가장 큰 표의 데이터 행 수(머리글 제외). */
export function tableStats(body: string): { count: number; maxDataRows: number } {
  let count = 0;
  let maxDataRows = 0;
  for (const table of body.matchAll(/<table>([\s\S]*?)<\/table>/g)) {
    count++;
    const rows = [...table[1]!.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    const dataRows = rows.filter((row) => !/<th>/.test(row[1]!)).length;
    if (dataRows > maxDataRows) maxDataRows = dataRows;
  }
  return { count, maxDataRows };
}

/**
 * 허용 목록을 어긴 태그와 속성을 찾습니다.
 * 빈 배열이면 통과입니다. 오류 메시지에 그대로 넣을 수 있는 문장을 돌려줍니다.
 */
export function disallowedBodyMarkup(body: string): string[] {
  const problems: string[] = [];
  for (const m of body.matchAll(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g)) {
    const closing = m[1] === "/";
    const tag = m[2]!.toLowerCase();
    const rest = m[3]!.replace(/\/\s*$/, "").trim();

    if (!ALLOWED_BODY_TAGS.includes(tag)) {
      problems.push(`허용하지 않는 태그 <${tag}>`);
      continue;
    }
    if (rest.length > 0) {
      problems.push(`태그 <${tag}> 에 속성이 있습니다: ${rest}${closing ? " (닫는 태그)" : ""}`);
    }
  }
  return problems;
}

export interface CardTerm {
  term: string;
  definition: string;
}

/** "이어서 볼 것" 질문 칩. to 는 같은 팩 안의 카드 id 여야 합니다. */
export interface CardLink {
  question: string;
  to: string;
}

export interface Card {
  id: string;
  track: Track;
  title: string;
  /** 예상 소요 분. */
  minutes: number;
  lead: string;
  axis: CardAxis;
  /** 검증을 통과한 HTML 조각. 렌더러가 그대로 넣습니다. */
  body: string;
  /** "이걸 알면 무엇이 달라지나" — 감사 작업으로 이어지는 한 문장. */
  audit: string;
  terms: CardTerm[];
  next: CardLink[];
}

/** 팩 전체에 걸리는 출처와 시점 한계. 화면 아래에 항상 보입니다. */
export interface PackSource {
  basis: string;
  collectedRange: string;
  asOf: string;
  limitation: string;
  /** 이 팩으로 답할 수 없는 것. pack.json 의 known_limits 를 그대로 보여 줍니다. */
  limits: string[];
}

export interface PackMeta {
  id: string;
  industry: string;
  title: string;
  subtitle: string;
  /** 시작 버튼을 눌렀을 때 처음 여는 카드. */
  entryCardId: string;
  source: PackSource;
  searchNote: string;
}

/** 밸류체인 위치. note 가 있으면 고를 때 함께 보여 줍니다. */
export interface ValueChainPosition {
  id: string;
  label: string;
  note: string;
}

/** 담당 필드 → 그 필드에서 먼저 볼 카드. */
export interface FieldOption {
  id: string;
  label: string;
  card: string;
}

export interface FieldMatrix {
  positions: ValueChainPosition[];
  fields: FieldOption[];
  /** 담당 필드와 무관하게 "내 필드" 목록에 항상 넣는 카드. */
  alwaysCards: string[];
  note: string;
}

export interface Pack {
  meta: PackMeta;
  cards: Card[];
  fieldMatrix: FieldMatrix;
}

export function cardsById(cards: Card[]): Map<string, Card> {
  return new Map(cards.map((c) => [c.id, c]));
}

/** 팩 전체 예상 소요 분. */
export function totalMinutes(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + c.minutes, 0);
}
