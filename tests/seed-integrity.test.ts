/**
 * 골든 데이터셋 신뢰성 검사.
 *
 * 실행: npm test  (추가 설치 없이 Node 내장 테스트 러너로 동작)
 *
 * 여기서 막으려는 것:
 *  - 근거 없는 사실 단정
 *  - 산업 일반 근거로 회사 특정 사실을 만드는 승격
 *  - 인용문이 원문에 없거나 페이지가 어긋나는 경우
 *  - 미확인 항목이 조용히 사라지는 경우
 *  - 위험·요청자료·질문의 근거 사슬이 끊어지는 경우
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { loadSeed, loadPageText, byId, SOURCES_DIR } from "../src/seed/load.ts";
import { normalizeForQuoteMatch, canSupportFact, sourceCoversScope } from "../src/domain/rules.ts";
import {
  ASSERTION_STATUS,
  REVIEW_STATUS,
  SCOPE,
  TRUST_GRADE,
  EVIDENCE_RELATION,
} from "../src/domain/types.ts";

const seed = loadSeed();
const sources = byId(seed.sources);
const spans = byId(seed.evidenceSpans);
const claims = byId(seed.claims);
const steps = byId(seed.steps);
const risks = byId(seed.risks);
const requests = byId(seed.requestItems);
const questions = byId(seed.interviewQuestions);

test("T1 골든 Claim 수와 상태 구성이 문서와 일치한다", () => {
  // 2026-08-05: 회계기준 출처(SRC-003) 등록으로 20건 → 25건.
  assert.equal(seed.claims.length, 25);
  const count = (s: string) => seed.claims.filter((c) => c.assertion_status === s).length;
  assert.equal(count("FACT"), 16);
  assert.equal(count("INFERENCE"), 5);
  assert.equal(count("UNVERIFIED"), 4);
});

test("T2 열거값이 정의된 범위를 벗어나지 않는다", () => {
  for (const c of seed.claims) {
    assert.ok(ASSERTION_STATUS.includes(c.assertion_status), `${c.id} 상태: ${c.assertion_status}`);
    assert.ok(REVIEW_STATUS.includes(c.review_status), `${c.id} 검토상태: ${c.review_status}`);
    assert.ok(SCOPE.includes(c.scope), `${c.id} 범위: ${c.scope}`);
    for (const e of c.evidence ?? []) {
      assert.ok(EVIDENCE_RELATION.includes(e.relation), `${c.id} 근거관계: ${e.relation}`);
    }
  }
  for (const s of seed.sources) {
    assert.ok(TRUST_GRADE.includes(s.trust_grade), `${s.id} 등급: ${s.trust_grade}`);
  }
});

test("T3 모든 FACT Claim은 직접 지지하는 Evidence를 최소 1개 가진다", () => {
  const facts = seed.claims.filter((c) => c.assertion_status === "FACT");
  assert.ok(facts.length > 0);
  for (const c of facts) {
    const supporting = (c.evidence ?? []).filter((e: any) => e.relation === "SUPPORTS");
    assert.ok(supporting.length >= 1, `${c.id} 에 지지 근거가 없습니다`);
  }
});

test("T4 모든 근거 참조가 실제 Evidence Span과 출처로 이어진다", () => {
  for (const c of seed.claims) {
    for (const e of c.evidence ?? []) {
      const span = spans.get(e.span_id);
      assert.ok(span, `${c.id} 가 존재하지 않는 근거 ${e.span_id} 를 참조합니다`);
      assert.ok(sources.get(span.source_id), `${span.id} 의 출처 ${span.source_id} 가 없습니다`);
    }
  }
});

test("T5 산업 일반 근거로 회사 특정 사실을 만들 수 없다", () => {
  for (const c of seed.claims) {
    if (c.assertion_status !== "FACT") continue;
    for (const e of (c.evidence ?? []).filter((x: any) => x.relation === "SUPPORTS")) {
      const span = spans.get(e.span_id)!;
      const source = sources.get(span.source_id)!;
      assert.ok(
        sourceCoversScope(source, c.scope),
        `${c.id}(${c.scope}) 를 ${source.id} 가 뒷받침할 수 없습니다. 허용 범위: ${source.can_support_scope}`,
      );
    }
  }
});

test("T6 회사 특정 Claim은 회사 특정 근거 없이 FACT가 될 수 없다", () => {
  const companyFacts = seed.claims.filter((c) => c.scope === "COMPANY" && c.assertion_status === "FACT");
  assert.deepEqual(
    companyFacts.map((c) => c.id),
    [],
    "회사 특정 근거가 없는 상태에서 FACT로 승격된 Claim이 있습니다",
  );
});

test("T7 원문 스냅샷이 없는 출처는 FACT의 근거가 될 수 없다", () => {
  for (const c of seed.claims) {
    if (c.assertion_status !== "FACT") continue;
    for (const e of (c.evidence ?? []).filter((x: any) => x.relation === "SUPPORTS")) {
      const source = sources.get(spans.get(e.span_id)!.source_id)!;
      assert.ok(canSupportFact(source), `${c.id} 의 근거 출처 ${source.id} 에 원문 스냅샷·해시가 없습니다`);
    }
  }
});

test("T8 스냅샷 파일이 실제로 존재하고 해시가 일치한다", () => {
  for (const s of seed.sources) {
    const snap = s.snapshot;
    if (!snap?.file) continue;
    const path = join(SOURCES_DIR, snap.file);
    assert.ok(existsSync(path), `${s.id} 스냅샷 파일이 없습니다: ${snap.file}`);
    if (!snap.sha256) continue;
    const bytes = readFileSync(path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), snap.sha256, `${s.id} 해시 불일치`);
    assert.equal(bytes.length, snap.bytes, `${s.id} 파일 크기 불일치`);
  }
});

test("T9 모든 인용문이 지정한 페이지의 원문에 실제로 존재한다", () => {
  let checked = 0;
  for (const source of seed.sources) {
    const textFile = source.snapshot?.pages_text_file;
    if (!textFile) continue;

    const pageText = loadPageText(textFile);
    assert.equal(pageText.pdf_sha256, source.snapshot.sha256, `${source.id} 추출본이 현재 PDF와 다릅니다`);

    for (const span of seed.evidenceSpans.filter((s) => s.source_id === source.id)) {
      const raw = pageText.pages[String(span.page)];
      assert.ok(raw, `${span.id} 가 가리키는 ${span.page} 페이지가 없습니다`);
      assert.ok(
        normalizeForQuoteMatch(raw).includes(normalizeForQuoteMatch(span.quote)),
        `${span.id} 의 인용문을 ${source.id} p.${span.page} 에서 찾을 수 없습니다:\n  ${span.quote.slice(0, 90)}...`,
      );
      checked++;
    }
  }
  assert.ok(checked >= 18, `인용 검증이 ${checked}건만 실행되었습니다`);
});

test("T10 INFERENCE는 전제 Claim을 가지며 직접 근거로 사실처럼 보이지 않는다", () => {
  for (const c of seed.claims.filter((x) => x.assertion_status === "INFERENCE")) {
    assert.ok((c.premises ?? []).length >= 1, `${c.id} 에 전제가 없습니다`);
    for (const p of c.premises) {
      assert.ok(claims.get(p), `${c.id} 의 전제 ${p} 가 존재하지 않습니다`);
    }
    assert.equal((c.evidence ?? []).length, 0, `${c.id} 는 추정인데 직접 근거가 붙어 있습니다`);
    assert.ok(typeof c.inference_note === "string" && c.inference_note.length > 0, `${c.id} 추론 설명 누락`);
  }
});

test("T11 UNVERIFIED는 요청자료 또는 인터뷰 질문으로 전환된다", () => {
  const unverified = seed.claims.filter((c) => c.assertion_status === "UNVERIFIED");
  assert.ok(unverified.length >= 1);
  for (const c of unverified) {
    const conv = c.converts_to ?? {};
    const total = (conv.request_items ?? []).length + (conv.interview_questions ?? []).length;
    assert.ok(total >= 1, `${c.id} 가 아무 확인 행동으로도 전환되지 않았습니다`);
    for (const r of conv.request_items ?? []) assert.ok(requests.get(r), `${c.id} → 없는 요청자료 ${r}`);
    for (const q of conv.interview_questions ?? []) assert.ok(questions.get(q), `${c.id} → 없는 질문 ${q}`);
  }
});

test("T12 거래 단계 참조가 양방향으로 일치한다", () => {
  for (const c of seed.claims) {
    for (const s of c.steps ?? []) assert.ok(steps.get(s), `${c.id} → 없는 거래 단계 ${s}`);
  }
  for (const st of seed.steps) {
    for (const cid of st.claims ?? []) {
      const c = claims.get(cid);
      assert.ok(c, `${st.id} → 없는 Claim ${cid}`);
      assert.ok((c.steps ?? []).includes(st.id), `${cid} 와 ${st.id} 의 연결이 한쪽에만 있습니다`);
    }
  }
});

test("T13 위험은 근거 Claim과 거래 단계로 역추적된다", () => {
  assert.equal(seed.risks.length, 5);
  for (const r of seed.risks) {
    assert.ok(steps.get(r.step_id), `${r.id} → 없는 거래 단계 ${r.step_id}`);
    assert.ok((r.rationale_claims ?? []).length >= 1, `${r.id} 에 근거 Claim이 없습니다`);
    for (const cid of [
      ...(r.rationale_claims ?? []),
      ...(r.counter_claims ?? []),
      ...(r.open_questions ?? []),
    ]) {
      assert.ok(claims.get(cid), `${r.id} → 없는 Claim ${cid}`);
    }
  }
});

test("T14 위험 문구는 확정 표현 대신 확인 필요로 표현된다", () => {
  const forbidden = ["임이 확인되었다", "확정된다", "위반이다", "부적정하다", "감사의견"];
  for (const r of seed.risks) {
    for (const word of forbidden) {
      assert.ok(!r.risk_text.includes(word), `${r.id} 위험 문구에 확정 표현 "${word}" 가 있습니다`);
    }
    assert.ok(
      r.risk_text.includes("가능성") && r.risk_text.includes("확인"),
      `${r.id} 위험 문구가 "가능성 … 확인 필요" 형태가 아닙니다`,
    );
  }
});

test("T15 요청자료 8건과 인터뷰 질문 10건이 위험·Claim으로 역추적된다", () => {
  assert.equal(seed.requestItems.length, 8);
  assert.equal(seed.interviewQuestions.length, 10);
  for (const row of [...seed.requestItems, ...seed.interviewQuestions]) {
    assert.ok((row.risk_ids ?? []).length >= 1, `${row.id} 에 연결된 위험이 없습니다`);
    for (const rid of row.risk_ids) assert.ok(risks.get(rid), `${row.id} → 없는 위험 ${rid}`);
    assert.ok((row.claim_ids ?? []).length >= 1, `${row.id} 에 연결된 Claim이 없습니다`);
    for (const cid of row.claim_ids) assert.ok(claims.get(cid), `${row.id} → 없는 Claim ${cid}`);
  }
});

test("T16 모든 위험이 최소 한 개의 요청자료 또는 질문으로 이어진다", () => {
  const covered = new Set<string>();
  for (const row of [...seed.requestItems, ...seed.interviewQuestions]) {
    for (const rid of row.risk_ids ?? []) covered.add(rid);
  }
  for (const r of seed.risks) {
    assert.ok(covered.has(r.id), `${r.id} 에서 나온 요청자료·질문이 하나도 없습니다`);
  }
});

test("T17 데모 사례는 가상 회사이며 회사 특정 근거가 등록되어 있지 않다", () => {
  assert.equal(seed.case.is_fictional, true);
  for (const s of seed.sources) {
    assert.ok(
      !(s.can_support_scope ?? []).includes("COMPANY"),
      `${s.id} 가 회사 특정 근거로 등록되어 있습니다. 가상 회사 사례에서는 허용하지 않습니다.`,
    );
  }
});

test("T18 ID가 중복되지 않는다", () => {
  const groups: Array<[string, Array<{ id: string }>]> = [
    ["source", seed.sources],
    ["evidence", seed.evidenceSpans],
    ["claim", seed.claims],
    ["step", seed.steps],
    ["risk", seed.risks],
    ["request", seed.requestItems],
    ["question", seed.interviewQuestions],
  ];
  for (const [name, rows] of groups) {
    assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, `${name} ID 중복`);
  }
});

test("T19 산업 일반 Claim의 문장이 특정 회사를 가리키지 않는다", () => {
  // 상태는 INDUSTRY인데 문장은 "이 회사는 …"이라고 쓰면,
  // 범위 검사(T5)를 통과하면서도 읽는 사람에게는 회사 사실로 보입니다.
  const companyWords = ["이 회사", "당사", "본 회사", "해당 회사의"];
  for (const c of seed.claims.filter((x) => x.scope === "INDUSTRY")) {
    for (const w of companyWords) {
      assert.ok(!c.text.includes(w), `${c.id}(산업 일반)의 문장에 회사 지시어 "${w}" 가 있습니다: ${c.text}`);
    }
  }
});

test("T20 추정 Claim의 문장이 단정형으로 쓰이지 않았다", () => {
  // 상태 배지가 '추정'이어도 문장이 단정형이면 사실처럼 읽힙니다.
  const hedges = ["가능성", "수 있", "배제할 수 없"];
  for (const c of seed.claims.filter((x) => x.assertion_status === "INFERENCE")) {
    assert.ok(
      hedges.some((h) => c.text.includes(h)),
      `${c.id}(추정)의 문장에 유보 표현이 없습니다: ${c.text}`,
    );
  }
});
