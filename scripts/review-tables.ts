/**
 * 사용자 검토용 표를 마크다운으로 출력합니다.
 * 손으로 옮겨 적지 않고 시드 데이터에서 직접 만들어, 표와 데이터가 어긋나지 않게 합니다.
 *
 * 실행: npm run review
 */

import { loadSeed, byId } from "../src/seed/load.ts";
import { ASSERTION_LABEL_KO, SCOPE_LABEL_KO } from "../src/domain/types.ts";
import type { Claim } from "../src/domain/model.ts";
import { canSupportFact, sourceCoversScope } from "../src/domain/rules.ts";

const seed = loadSeed();
const spans = byId(seed.evidenceSpans);
const sources = byId(seed.sources);
const claims = byId(seed.claims);

const p = (s = "") => console.log(s);
const label = (c: Claim) =>
  `${ASSERTION_LABEL_KO[c.assertion_status].mark} ${ASSERTION_LABEL_KO[c.assertion_status].label}`;

/* 표 1 — Claim 20건 */
p("## 표 1. 골든 Claim 20건\n");
p("| ID | 상태 | 범위 | 주장 | 근거 / 전제 |");
p("|---|---|---|---|---|");
for (const c of seed.claims) {
  const basis = (c.evidence ?? []).length
    ? (c.evidence as any[]).map((e) => e.span_id).join(", ")
    : (c.premises ?? []).length
      ? `전제 ${c.premises.join(", ")}`
      : "없음";
  p(
    `| ${c.id} | ${label(c)} | ${SCOPE_LABEL_KO[c.scope as keyof typeof SCOPE_LABEL_KO]} | ${c.text} | ${basis} |`,
  );
}

/* 표 2 — FACT의 근거 위치 */
p("\n## 표 2. 사실 Claim의 근거 출처와 정확한 위치\n");
p("| Claim | 근거 | 출처 | 위치 | 원문 발췌 |");
p("|---|---|---|---|---|");
for (const c of seed.claims.filter((x) => x.assertion_status === "FACT")) {
  for (const e of c.evidence as any[]) {
    const s = spans.get(e.span_id)!;
    const src = sources.get(s.source_id)!;
    p(
      `| ${c.id} | ${s.id} | ${src.id} ${src.title} | p.${s.page} § ${s.section} | ${s.quote.replace(/\|/g, "\\|")} |`,
    );
  }
}

/* 표 3 — 승격 검사 */
p("\n## 표 3. 잘못된 승격 재검사\n");
p("| 검사 | 대상 | 결과 |");
p("|---|---|---|");
const companyFacts = seed.claims.filter((c) => c.scope === "COMPANY" && c.assertion_status === "FACT");
p(
  `| 회사 특정 Claim이 사실로 승격됨 | 회사 범위 ${seed.claims.filter((c) => c.scope === "COMPANY").length}건 | ${companyFacts.length === 0 ? "위반 0건" : "위반 " + companyFacts.map((c) => c.id).join(", ")} |`,
);

const scopeViolations: string[] = [];
const snapViolations: string[] = [];
for (const c of seed.claims.filter((x) => x.assertion_status === "FACT")) {
  for (const e of (c.evidence as any[]).filter((x) => x.relation === "SUPPORTS")) {
    const src = sources.get(spans.get(e.span_id)!.source_id)!;
    if (!sourceCoversScope(src, c.scope)) scopeViolations.push(`${c.id}←${src.id}`);
    if (!canSupportFact(src)) snapViolations.push(`${c.id}←${src.id}`);
  }
}
p(
  `| 근거 범위를 넘는 사실 | 사실 ${seed.claims.filter((c) => c.assertion_status === "FACT").length}건의 근거 | ${scopeViolations.length === 0 ? "위반 0건" : scopeViolations.join(", ")} |`,
);
p(
  `| 스냅샷 없는 출처가 사실을 지지 | 같음 | ${snapViolations.length === 0 ? "위반 0건" : snapViolations.join(", ")} |`,
);
const companyCapable = seed.sources.filter((s) => (s.can_support_scope ?? []).includes("COMPANY"));
p(
  `| 회사 특정 근거로 등록된 출처 | 출처 ${seed.sources.length}건 | ${companyCapable.length === 0 ? "0건 (가상 사례이므로 정상)" : companyCapable.map((s) => s.id).join(", ")} |`,
);
const industryWithCompanyWord = seed.claims.filter(
  (c) => c.scope === "INDUSTRY" && ["이 회사", "당사", "본 회사"].some((w) => c.text.includes(w)),
);
p(
  `| 산업 일반 문장이 회사를 가리킴 | 산업 일반 ${seed.claims.filter((c) => c.scope === "INDUSTRY").length}건 | ${industryWithCompanyWord.length === 0 ? "위반 0건" : industryWithCompanyWord.map((c) => c.id).join(", ")} |`,
);

/* 표 4 — 역추적 */
p("\n## 표 4. 위험 · 요청자료 · 인터뷰 질문의 출발점\n");
p("| 항목 | 내용 | 출발 위험 | 출발 Claim | 그 Claim의 상태 |");
p("|---|---|---|---|---|");
for (const r of seed.risks) {
  const st = (r.rationale_claims as string[]).map(
    (id) => `${id}(${ASSERTION_LABEL_KO[claims.get(id)!.assertion_status].label})`,
  );
  p(`| ${r.id} | ${r.title} | — | ${(r.rationale_claims as string[]).join(", ")} | ${st.join(", ")} |`);
}
for (const row of [...seed.requestItems, ...seed.interviewQuestions]) {
  const text = "item" in row ? row.item : row.question;
  const st = row.claim_ids.map((id) => ASSERTION_LABEL_KO[claims.get(id)!.assertion_status].label);
  p(`| ${row.id} | ${text} | ${row.risk_ids.join(", ")} | ${row.claim_ids.join(", ")} | ${st.join(", ")} |`);
}

/* 표 5 — 미확인 항목의 전환 */
p("\n## 표 5. 미확인 항목이 무엇으로 전환되었는가\n");
p("| Claim | 미확인 내용 | 요청자료 | 인터뷰 질문 | 이것이 막고 있는 추정 |");
p("|---|---|---|---|---|");
for (const c of seed.claims.filter((x) => x.assertion_status === "UNVERIFIED")) {
  const conv = c.converts_to ?? {};
  p(
    `| ${c.id} | ${c.text} | ${(conv.request_items ?? []).join(", ") || "—"} | ${(conv.interview_questions ?? []).join(", ") || "—"} | ${(c.blocks_resolution_of ?? []).join(", ") || "—"} |`,
  );
}
p("");
