/**
 * 골든 데이터셋을 사람이 읽는 형태로 출력합니다.
 * 화면이 만들어지기 전까지 사용자 검토용으로 씁니다.
 *
 * 실행: npm run seed:report
 */

import { loadSeed, byId } from "../src/seed/load.ts";
import { ASSERTION_LABEL_KO, SCOPE_LABEL_KO } from "../src/domain/types.ts";

const seed = loadSeed();
const spans = byId(seed.evidenceSpans);
const sources = byId(seed.sources);
const claims = byId(seed.claims);

const line = (n = 78) => console.log("─".repeat(n));

console.log(`
==============================================================================
 이 출력은 무엇인가요?

 사람이 손으로 만든 기준 데이터(골든 데이터셋)입니다.
 나중에 AI가 문서에서 주장을 자동으로 뽑을 때, 그 결과를 채점할 정답지가 됩니다.

 읽는 법
  ◆ 사실   근거 원문이 이 문장을 직접 뒷받침합니다. 바로 아래 출처와 페이지가 붙습니다.
  ◇ 추정   사실에서 도출했을 뿐 확인되지 않았습니다. '전제'로 어디서 왔는지 표시됩니다.
  ?  미확인 근거가 없습니다. 숨기지 않고 요청자료·인터뷰 질문으로 넘깁니다.

 이 데모는 가상 여행사입니다. 회사의 계약서나 조회서를 만들지 않았기 때문에
 회사에 관한 문장은 전부 추정 또는 미확인입니다. 이는 결함이 아니라 의도된 상태입니다.
==============================================================================`);

console.log(
  `\n사례: ${seed.case.company_name} (가상)  기간: ${seed.case.period_start} ~ ${seed.case.period_end}`,
);
line();

const order = ["FACT", "INFERENCE", "UNVERIFIED", "CONFLICTING"] as const;
for (const status of order) {
  const rows = seed.claims.filter((c) => c.assertion_status === status);
  if (rows.length === 0) continue;
  const meta = ASSERTION_LABEL_KO[status];
  console.log(`\n[${meta.mark} ${meta.label}] ${rows.length}건 — ${meta.hint}`);
  line();
  for (const c of rows) {
    console.log(`${c.id}  (${SCOPE_LABEL_KO[c.scope as keyof typeof SCOPE_LABEL_KO]})`);
    console.log(`  ${c.text}`);
    for (const e of c.evidence ?? []) {
      const span = spans.get(e.span_id)!;
      const src = sources.get(span.source_id)!;
      console.log(`  └ 근거 ${span.id}: ${src.title}, p.${span.page}, ${span.section}`);
      console.log(`     "${span.quote.slice(0, 110)}${span.quote.length > 110 ? "…" : ""}"`);
    }
    if (c.premises?.length) {
      console.log(`  └ 전제: ${c.premises.join(", ")}`);
      console.log(`     ${c.inference_note}`);
    }
    if (c.converts_to) {
      const conv = [...(c.converts_to.request_items ?? []), ...(c.converts_to.interview_questions ?? [])];
      console.log(`  └ 확인 행동으로 전환: ${conv.join(", ")}`);
    }
    console.log("");
  }
}

console.log("\n[위험 → 요청자료 · 인터뷰 질문 연결]");
line();
for (const r of seed.risks) {
  console.log(`${r.id} ${r.title}  (${(r.assertions ?? []).join(", ")})  단계 ${r.step_id}`);
  console.log(`  ${r.risk_text}`);
  console.log(`  근거 Claim: ${(r.rationale_claims ?? []).join(", ")}`);
  if (r.counter_claims?.length) console.log(`  반대 방향 Claim: ${r.counter_claims.join(", ")}`);
  if (r.open_questions?.length) console.log(`  미확인: ${r.open_questions.join(", ")}`);
  const rq = seed.requestItems.filter((x) => (x.risk_ids ?? []).includes(r.id));
  const iq = seed.interviewQuestions.filter((x) => (x.risk_ids ?? []).includes(r.id));
  for (const x of rq) console.log(`  · 요청자료 ${x.id}: ${x.item}`);
  for (const x of iq) console.log(`  · 질문 ${x.id}: ${x.question}`);
  console.log("");
}

const counts = order.map(
  (s) => `${ASSERTION_LABEL_KO[s].label} ${seed.claims.filter((c) => c.assertion_status === s).length}`,
);
line();
console.log(
  `Claim ${seed.claims.length}건 (${counts.join(" / ")}) · 위험 ${seed.risks.length} · 요청자료 ${seed.requestItems.length} · 질문 ${seed.interviewQuestions.length}`,
);
console.log(
  `미해결 Claim: ${seed.claims
    .filter((c) => c.assertion_status !== "FACT")
    .map((c) => c.id)
    .join(", ")}`,
);
console.log(`
──────────────────────────────────────────────────────────────────────────────
 이제 무엇을 보시면 되나요?

 1. 사실 ${seed.claims.filter((c) => c.assertion_status === "FACT").length}건의 문장이 그 아래 원문 발췌와 실제로 맞는지
 2. 추정 ${seed.claims.filter((c) => c.assertion_status === "INFERENCE").length}건이 사실처럼 단정되어 있지 않은지
 3. 미확인 ${seed.claims.filter((c) => c.assertion_status === "UNVERIFIED").length}건이 요청자료·질문으로 넘어갔는지
 4. 위험 ${seed.risks.length}건이 "확정"이 아니라 "가능성·확인 필요"로 쓰였는지
 5. 요청자료 ${seed.requestItems.length}건과 질문 ${seed.interviewQuestions.length}건이 실무에서 쓸 만한지

 이상한 항목이 있으면 그 ID(예: CL-009, RQ-04)를 Claude Code에 알려주세요.
──────────────────────────────────────────────────────────────────────────────
`);
void claims;
