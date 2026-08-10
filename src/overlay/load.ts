/**
 * 회사 오버레이 로더.
 *
 * seed/<company>/overlay.json + claims.json + sources/manifest.json 을 읽어
 * 차이표 행의 상태를 **계산**하고, 화면이 보기 전에 신뢰 규칙을 검사합니다.
 * 어긴 항목은 전부 모아 한 번에 알립니다.
 *
 * 오버레이는 packs/ 가 아니라 seed/ 의 규칙 아래 있습니다(ADR 0011).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "../seed/load.ts";
import { deriveRowStatus } from "../domain/overlay.ts";
import type {
  Overlay,
  OverlayMeta,
  OverlayProfile,
  OverlayQuestion,
  OverlayRow,
  OverlayRowSpec,
} from "../domain/overlay.ts";
import type { Claim, EvidenceSpan, PageText, Source } from "../domain/model.ts";

interface RawOverlay {
  meta: OverlayMeta;
  profile: OverlayProfile;
  rows: OverlayRowSpec[];
  questions: OverlayQuestion[];
}

export interface CompanyOverlay extends Overlay {
  dir: string;
  sources: Source[];
  evidenceSpans: EvidenceSpan[];
  claims: Claim[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function overlayDir(id: string): string {
  return join(REPO_ROOT, "seed", id);
}

/** overlay.json 을 가진 seed 폴더만 오버레이입니다. */
export function listOverlayIds(): string[] {
  const seedRoot = join(REPO_ROOT, "seed");
  if (!existsSync(seedRoot)) return [];
  return readdirSync(seedRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(seedRoot, e.name, "overlay.json")))
    .map((e) => e.name)
    .sort();
}

export function loadOverlay(id: string): CompanyOverlay {
  const dir = overlayDir(id);
  const raw = readJson<RawOverlay>(join(dir, "overlay.json"));
  const claims = readJson<{ claims: Claim[] }>(join(dir, "claims.json")).claims;
  const manifest = readJson<{ sources: Source[]; evidence_spans: EvidenceSpan[] }>(
    join(dir, "sources", "manifest.json"),
  );

  const claimById = new Map(claims.map((c) => [c.id, c]));
  const rows: OverlayRow[] = raw.rows.map((spec) => ({
    ...spec,
    status: deriveRowStatus(spec),
    claims: spec.companyClaimIds.map((cid) => claimById.get(cid)).filter((c): c is Claim => Boolean(c)),
  }));

  const overlay: CompanyOverlay = {
    dir,
    meta: raw.meta,
    profile: raw.profile,
    rows,
    questions: raw.questions,
    sources: manifest.sources,
    evidenceSpans: manifest.evidence_spans,
    claims,
  };

  validateOverlay(overlay);
  return overlay;
}

export function loadAllOverlays(): CompanyOverlay[] {
  return listOverlayIds().map((id) => loadOverlay(id));
}

/** 섹션별 원문. 근거를 눌렀을 때 열 원문을 여기서 가져옵니다. */
export function loadSectionText(id: string, fileName: string): PageText {
  return readJson<PageText>(join(overlayDir(id), "sources", fileName));
}

/**
 * 화면이 오버레이를 보기 전에 거는 검사.
 *
 * 여기서 막는 것은 전부 CLAUDE.md 의 도메인 규칙이며, 규칙 번호를 메시지에 남깁니다.
 * 사람이 오류를 읽고 "왜 막혔는지"까지 알 수 있어야 규칙이 작동합니다.
 */
export function validateOverlay(overlay: CompanyOverlay): void {
  const problems: string[] = [];
  const { meta, rows, questions, claims, evidenceSpans, sources } = overlay;

  const spanIds = new Set(evidenceSpans.map((s) => s.id));
  const sourceIds = new Set(sources.map((s) => s.id));
  const claimIds = new Set(claims.map((c) => c.id));
  const questionIds = new Set(questions.map((q) => q.id));

  /* 1. Claim 은 전부 이 회사 특정 사실이어야 하고 직접 근거를 가져야 한다 (규칙 2·4) */
  for (const claim of claims) {
    if (claim.scope !== "COMPANY") {
      problems.push(`[규칙 4] Claim ${claim.id} 의 scope 가 COMPANY 가 아닙니다: ${claim.scope}`);
    }
    if (claim.assertion_status === "FACT" && claim.evidence.length === 0) {
      problems.push(`[규칙 2] Claim ${claim.id} 이 FACT 인데 직접 근거가 없습니다.`);
    }
    for (const ev of claim.evidence) {
      if (!spanIds.has(ev.span_id)) {
        problems.push(`Claim ${claim.id} 의 근거 ${ev.span_id} 가 manifest 에 없습니다.`);
      }
    }
  }

  /* 2. 근거는 회사 특정 출처에서만 온다 (규칙 4) */
  for (const span of evidenceSpans) {
    if (!sourceIds.has(span.source_id)) {
      problems.push(`근거 ${span.id} 의 출처 ${span.source_id} 가 manifest 에 없습니다.`);
    }
  }
  for (const source of sources) {
    if (!source.can_support_scope.includes("COMPANY")) {
      problems.push(
        `[규칙 4] 출처 ${source.id} 는 회사 특정 주장을 지지할 수 없습니다(can_support_scope 에 COMPANY 없음).`,
      );
    }
  }

  /* 3. 행의 상태는 계산값과 일치해야 한다 */
  for (const row of rows) {
    if (row.status !== deriveRowStatus(row)) {
      problems.push(`행 ${row.id} 의 상태가 계산값과 다릅니다. 상태는 직접 적는 값이 아닙니다.`);
    }

    for (const cid of row.companyClaimIds) {
      if (!claimIds.has(cid)) problems.push(`행 ${row.id} 가 없는 Claim 을 가리킵니다: ${cid}`);
    }

    /* FACT 행은 참조한 Claim 이 전부 FACT 여야 한다 (규칙 2) */
    if (row.status === "FACT") {
      for (const claim of row.claims) {
        if (claim.assertion_status !== "FACT") {
          problems.push(
            `[규칙 2] 행 ${row.id} 이 회사 확인인데 Claim ${claim.id} 은 ${claim.assertion_status} 입니다.`,
          );
        }
      }
    }

    /* 미확인 행은 반드시 질문으로 전환된다 (규칙 8) */
    if (row.status === "UNVERIFIED") {
      if (!row.questionId) {
        problems.push(`[규칙 8] 행 ${row.id} 이 미확인인데 질문으로 전환되지 않았습니다.`);
      } else if (!questionIds.has(row.questionId)) {
        problems.push(`행 ${row.id} 이 없는 질문을 가리킵니다: ${row.questionId}`);
      }
    }

    /* 산업 카드는 비교 기준일 뿐 근거가 아니다 (규칙 4·ADR 0011 규칙 2) */
    if (row.industry.packId !== meta.packId) {
      problems.push(`행 ${row.id} 이 다른 팩(${row.industry.packId})의 카드를 비교 기준으로 씁니다.`);
    }
    if (!row.industry.statement.trim()) {
      problems.push(`행 ${row.id} 에 비교 기준 문장이 없습니다.`);
    }
    if (!row.industry.cardId && !row.industry.conceptId) {
      problems.push(`행 ${row.id} 의 비교 기준이 카드도 개념도 가리키지 않습니다.`);
    }
  }

  /* 4. 질문은 반드시 어느 행에서 왔는지 들고 있어야 한다 (역추적) */
  const rowIds = new Set(rows.map((r) => r.id));
  for (const q of questions) {
    if (!rowIds.has(q.fromRow)) {
      problems.push(`질문 ${q.id} 의 출발 행 ${q.fromRow} 이 없습니다. 역추적이 끊깁니다.`);
    }
  }

  /* 5. 미확인 행과 질문의 수가 맞아야 한다 — 조용히 사라진 빈칸이 없도록 (규칙 8) */
  const unverified = rows.filter((r) => r.status === "UNVERIFIED");
  const covered = new Set(questions.map((q) => q.fromRow));
  for (const row of unverified) {
    if (!covered.has(row.id)) {
      problems.push(`[규칙 8] 미확인 행 ${row.id} 을 가리키는 질문이 없습니다.`);
    }
  }

  /* 6. 프로필의 금액 주장도 Claim 을 거쳐야 한다 */
  for (const id of overlay.profile.claimIds) {
    if (!claimIds.has(id)) problems.push(`개요가 없는 Claim 을 가리킵니다: ${id}`);
  }
  for (const seg of overlay.profile.segments) {
    if (seg.claimId && !claimIds.has(seg.claimId)) {
      problems.push(`사업부문 "${seg.name}" 이 없는 Claim 을 가리킵니다: ${seg.claimId}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `오버레이 "${meta.id}" 검증 실패 — ${problems.length}건\n` + problems.map((p) => `  - ${p}`).join("\n"),
    );
  }
}
