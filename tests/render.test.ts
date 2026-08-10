/**
 * 화면 렌더링 검사.
 *
 * 화면에 나오는 모든 내용을 서버에서 미리 만들기 때문에, 생성된 HTML만 보고
 * 신뢰성 규칙이 화면에서도 지켜지는지 검사할 수 있습니다.
 * 브라우저에서의 실제 동작(단계 전환, 근거 창 열림)은 별도로 눈으로 확인합니다.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { loadSeed, byId } from "../src/seed/load.ts";
import { renderPage } from "../src/render/page.ts";
import { ASSERTION_LABEL_KO } from "../src/domain/types.ts";

const seed = loadSeed();
const html = renderPage(seed);
const claims = byId(seed.claims);
const spans = byId(seed.evidenceSpans);

/** 화면에 들어갈 때 적용되는 HTML 이스케이프. 비교할 때 같은 변환을 적용합니다. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 특정 거래 단계 패널의 HTML 조각만 잘라냅니다. */
function panelOf(stepId: string): string {
  const start = html.indexOf(`data-step-panel="${stepId}"`);
  assert.ok(start > 0, `${stepId} 패널이 없습니다`);
  const next = html.indexOf(`<section class="step-panel`, start + 1);
  return html.slice(start, next === -1 ? html.length : next);
}

test("S1 기본 화면은 채팅창이 아니라 거래 지도다", () => {
  assert.match(html, /BSP 거래 지도/);
  assert.match(html, /<nav class="steps">/);
  assert.doesNotMatch(html, /<textarea/i, "채팅 입력창이 있으면 안 됩니다");
  assert.doesNotMatch(html, /<input[^>]*type="text"/i, "자유 입력창이 있으면 안 됩니다");
});

test("S2 모든 거래 단계가 좌측 목록과 본문에 있다", () => {
  assert.equal(seed.steps.length, 6);
  for (const s of seed.steps) {
    assert.ok(html.includes(`data-step="${s.id}"`), `${s.id} 단계 버튼 없음`);
    assert.ok(html.includes(`data-step-panel="${s.id}"`), `${s.id} 단계 패널 없음`);
    assert.ok(html.includes(s.name), `${s.id} 단계 이름 없음`);
  }
});

test("S3 상태를 색이 아니라 글자와 기호로 표시한다", () => {
  for (const status of ["FACT", "INFERENCE", "UNVERIFIED"] as const) {
    const m = ASSERTION_LABEL_KO[status];
    assert.ok(
      html.includes(`>${m.label}<`) || html.includes(`${m.mark}</span>${m.label}`),
      `${m.label} 표기 없음`,
    );
    assert.ok(html.includes(m.mark), `${m.label}의 기호 ${m.mark} 없음`);
  }
});

test("S4 모든 Claim이 상태 배지와 범위 표시를 달고 화면에 나온다", () => {
  for (const c of seed.claims) {
    assert.ok(html.includes(`data-claim="${c.id}"`), `${c.id} 가 화면에 없습니다`);
    assert.ok(html.includes(c.text), `${c.id} 의 문장이 화면에 없습니다`);
  }
  // 모든 Claim 카드는 상태와 범위 속성을 가집니다.
  const cards = html.match(/<article class="claim"[^>]*>/g) ?? [];
  assert.ok(cards.length >= seed.claims.length);
  for (const card of cards) {
    assert.match(card, /data-status="(FACT|INFERENCE|UNVERIFIED|CONFLICTING)"/);
    assert.match(card, /data-scope="(INDUSTRY|COMPANY|PERIOD|TRANSACTION)"/);
  }
});

test("S5 산업 일반과 회사 특정을 다르게 표시한다", () => {
  assert.match(html, /class="scope sc-industry">산업 일반</);
  assert.match(html, /class="scope sc-company">회사 특정</);
});

test("S6 모든 사실 Claim이 원문 발췌와 정확한 위치를 함께 보여준다", () => {
  for (const c of seed.claims.filter((x) => x.assertion_status === "FACT")) {
    for (const e of c.evidence) {
      const span = spans.get(e.span_id)!;
      assert.ok(html.includes(esc(span.quote).slice(0, 60)), `${c.id} 의 원문 발췌가 화면에 없습니다`);
      assert.ok(
        html.includes(`p.${span.page} · ${esc(span.section)}`),
        `${c.id} 의 원문 위치가 화면에 없습니다`,
      );
    }
  }
});

test("S7 근거를 누르면 열 수 있는 원문 링크가 페이지 번호까지 가리킨다", () => {
  for (const span of seed.evidenceSpans) {
    const src = seed.sources.find((s) => s.id === span.source_id)!;
    if (!src.snapshot.file.endsWith(".pdf")) continue;
    const link = `sources/${encodeURIComponent(src.snapshot.file)}#page=${span.page}`;
    if (seed.claims.some((c) => c.evidence.some((e) => e.span_id === span.id))) {
      assert.ok(html.includes(link), `${span.id} 의 원문 링크(${link})가 없습니다`);
    }
  }
});

test("S8 회사 특정 Claim이 화면에서 사실로 보이지 않는다", () => {
  const cards = html.match(/<article class="claim"[^>]*>/g) ?? [];
  for (const card of cards) {
    if (card.includes('data-scope="COMPANY"')) {
      assert.doesNotMatch(card, /data-status="FACT"/, `회사 특정 Claim이 사실로 표시되었습니다: ${card}`);
    }
  }
});

test("S9 미확인 항목을 숨기지 않고 확인 행동으로 연결한다", () => {
  for (const c of seed.claims.filter((x) => x.assertion_status === "UNVERIFIED")) {
    assert.ok(html.includes(c.text), `${c.id} 가 화면에서 빠졌습니다`);
    const conv = c.converts_to ?? {};
    for (const t of [...(conv.request_items ?? []), ...(conv.interview_questions ?? [])]) {
      assert.ok(html.includes(`>${t}</span>`), `${c.id} → ${t} 연결이 화면에 없습니다`);
    }
  }
  assert.match(html, /근거 없음 · 숨기지 않고 확인 행동으로 넘깁니다/);
});

test("S10 추정 Claim이 전제와 추론 설명을 함께 보여준다", () => {
  for (const c of seed.claims.filter((x) => x.assertion_status === "INFERENCE")) {
    assert.ok(html.includes(c.inference_note!), `${c.id} 의 추론 설명이 화면에 없습니다`);
    for (const p of c.premises) {
      assert.ok(html.includes(`data-goto="${p}"`), `${c.id} 의 전제 ${p} 로 가는 링크가 없습니다`);
    }
  }
});

test("S11 위험·요청자료·질문이 출발 Claim을 드러낸다", () => {
  for (const r of seed.risks) {
    const panel = panelOf(r.step_id);
    assert.ok(panel.includes(r.risk_text), `${r.id} 위험 문구가 ${r.step_id} 화면에 없습니다`);
    for (const cid of r.rationale_claims) {
      assert.ok(panel.includes(`data-goto="${cid}"`), `${r.id} 의 근거 ${cid} 링크가 없습니다`);
    }
  }
  for (const x of seed.requestItems) {
    assert.ok(html.includes(x.item), `${x.id} 요청자료가 화면에 없습니다`);
    assert.ok(html.includes(x.purpose), `${x.id} 의 요청 사유가 화면에 없습니다`);
  }
  for (const x of seed.interviewQuestions) {
    assert.ok(html.includes(x.question), `${x.id} 질문이 화면에 없습니다`);
  }
});

test("S12 화면에 단정형 위험 표현이 없다", () => {
  for (const r of seed.risks) {
    assert.ok(r.risk_text.includes("가능성"), `${r.id} 위험 문구에 유보 표현이 없습니다`);
  }
  assert.doesNotMatch(html, /감사의견/);
});

test("S13 HTML의 id가 중복되지 않는다", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual([...new Set(dup)], [], "중복된 id가 있습니다");
});

test("S14 가상 사례 경고가 화면 상단에 있다", () => {
  assert.match(html, /가상 사례입니다/);
  assert.ok(html.indexOf("가상 사례입니다") < html.indexOf('<div class="layout">'));
});

test("S15 신뢰도 숫자를 화면에 노출하지 않는다", () => {
  assert.doesNotMatch(html, /confidence/i);
  assert.doesNotMatch(html, /신뢰도/);
});

test("S16 화면에 나온 Claim 참조가 모두 실제 Claim이다", () => {
  for (const m of html.matchAll(/data-goto="([^"]+)"/g)) {
    assert.ok(claims.get(m[1]!), `화면이 없는 Claim ${m[1]} 을 가리킵니다`);
  }
  // CSS 정의가 아니라 실제로 사용된 곳만 봅니다.
  assert.doesNotMatch(html, /class="chip chip-missing"/, "깨진 Claim 참조가 화면에 있습니다");
});
