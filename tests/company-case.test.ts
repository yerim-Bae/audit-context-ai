/**
 * 실제 회사 사례(하나투어) 검사.
 *
 * 가상 사례와 달리 회사 특정 FACT가 존재할 수 있습니다. 대신 조건이 붙습니다.
 *  - 근거는 회사 특정 범위를 지지할 수 있는 출처여야 한다
 *  - 인용문이 지정한 섹션의 원문에 실제로 존재해야 한다
 *  - 스냅샷 해시가 일치해야 한다
 *  - 두 사례의 데이터가 섞이지 않아야 한다
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadCompanySeed, loadCompanySectionText, companyDir } from "../src/seed/loadCompany.ts";
import { loadSeed, byId } from "../src/seed/load.ts";
import { canSupportFact, normalizeForQuoteMatch, sourceCoversScope } from "../src/domain/rules.ts";
import { ASSERTION_STATUS, SCOPE } from "../src/domain/types.ts";

const NAME = "hanatour";
const company = loadCompanySeed(NAME);
const spans = byId(company.evidenceSpans);
const sources = byId(company.sources);
const fictional = loadSeed();

test("C1 회사 사례는 가상이 아니라고 표시되고 실제 회사 정책이 붙어 있다", () => {
  assert.equal(company.case.is_fictional, false);
  assert.ok(company.case.corp_code.length === 8);
  assert.ok(company.case.real_company_policy.consequence.includes("감사의견"));
});

test("C2 열거값이 정의된 범위를 벗어나지 않는다", () => {
  for (const c of company.claims) {
    assert.ok(ASSERTION_STATUS.includes(c.assertion_status), `${c.id} 상태`);
    assert.ok(SCOPE.includes(c.scope), `${c.id} 범위`);
  }
});

test("C3 모든 FACT는 회사 특정 범위를 지지할 수 있는 출처의 직접 근거를 가진다", () => {
  const facts = company.claims.filter((c) => c.assertion_status === "FACT");
  assert.ok(facts.length > 0);
  for (const c of facts) {
    const supporting = c.evidence.filter((e) => e.relation === "SUPPORTS");
    assert.ok(supporting.length >= 1, `${c.id} 에 지지 근거가 없습니다`);
    for (const e of supporting) {
      const span = spans.get(e.span_id);
      assert.ok(span, `${c.id} → 없는 근거 ${e.span_id}`);
      const src = sources.get(span.source_id);
      assert.ok(src, `${span.id} → 없는 출처 ${span.source_id}`);
      assert.ok(sourceCoversScope(src, c.scope), `${c.id}(${c.scope}) 를 ${src.id} 가 뒷받침할 수 없습니다`);
      assert.ok(canSupportFact(src), `${src.id} 에 원문 스냅샷·해시가 없습니다`);
    }
  }
});

test("C4 스냅샷 파일이 존재하고 해시가 일치한다", () => {
  for (const s of company.sources) {
    const path = join(companyDir(NAME), "sources", s.snapshot.file);
    assert.ok(existsSync(path), `${s.id} 스냅샷 없음: ${s.snapshot.file}`);
    const bytes = readFileSync(path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), s.snapshot.sha256, `${s.id} 해시 불일치`);
    assert.equal(bytes.length, s.snapshot.bytes, `${s.id} 크기 불일치`);
  }
});

test("C5 모든 인용문이 지정한 섹션의 원문에 실제로 존재한다", () => {
  let checked = 0;
  for (const s of company.sources) {
    const textFile = s.snapshot.pages_text_file;
    if (!textFile) continue;
    const doc = loadCompanySectionText(NAME, textFile);
    assert.equal(doc.sha256 ?? s.snapshot.sha256, s.snapshot.sha256, `${s.id} 추출본이 원문과 다릅니다`);

    for (const span of company.evidenceSpans.filter((x) => x.source_id === s.id)) {
      const raw = doc.pages[String(span.page)];
      assert.ok(raw, `${span.id} 가 가리키는 섹션 ${span.page} 가 없습니다`);
      assert.ok(
        normalizeForQuoteMatch(raw).includes(normalizeForQuoteMatch(span.quote)),
        `${span.id} 의 인용문을 섹션 ${span.page} 에서 찾을 수 없습니다:\n  ${span.quote.slice(0, 80)}...`,
      );
      checked++;
    }
  }
  assert.ok(checked >= 5, `인용 검증이 ${checked}건만 실행되었습니다`);
});

test("C6 회사 사례와 가상 사례의 Claim ID가 겹치지 않는다", () => {
  const fictionalIds = new Set(fictional.claims.map((c) => c.id));
  for (const c of company.claims) {
    assert.ok(!fictionalIds.has(c.id), `${c.id} 가 두 사례에 모두 있습니다`);
  }
});

test("C7 가상 사례에는 여전히 회사 특정 사실이 없다", () => {
  // DART 출처가 들어와도 가상 사례의 보장은 깨지지 않아야 합니다.
  const companyFacts = fictional.claims.filter((c) => c.scope === "COMPANY" && c.assertion_status === "FACT");
  assert.deepEqual(companyFacts, []);
  for (const s of fictional.sources) {
    assert.ok(
      !(s.can_support_scope ?? []).includes("COMPANY"),
      `${s.id} 가 가상 사례에 회사 근거로 들어왔습니다`,
    );
  }
});

test("C8 미확인 항목 대조표가 실제 Claim을 가리키고 확인 행동이 존재한다", () => {
  const fictionalClaims = byId(fictional.claims);
  const requests = byId(fictional.requestItems);
  const questions = byId(fictional.interviewQuestions);

  assert.ok(company.case.open_questions_status.length >= 3);
  for (const row of company.case.open_questions_status) {
    assert.ok(fictionalClaims.get(row.claim_id), `대조표가 없는 Claim ${row.claim_id} 을 가리킵니다`);
    assert.ok(["PARTIAL", "UNRESOLVED", "RESOLVED"].includes(row.outcome), `${row.claim_id} outcome`);
    assert.ok(row.next_action.length >= 1, `${row.claim_id} 에 다음 행동이 없습니다`);
    for (const a of row.next_action) {
      assert.ok(requests.get(a) || questions.get(a), `${row.claim_id} → 없는 확인 행동 ${a}`);
    }
  }
});

test("C9 회사 사례가 회계처리 적정성이나 감사의견을 말하지 않는다", () => {
  const forbidden = ["적정하다", "부적정", "감사의견", "위반이다", "타당하다"];
  for (const c of company.claims) {
    for (const w of forbidden) {
      assert.ok(!c.text.includes(w), `${c.id} 에 판단 표현 "${w}" 가 있습니다`);
    }
  }
});
