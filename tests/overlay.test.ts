/**
 * 회사 오버레이 검사 (O1~O12).
 *
 * `seed/` 의 신뢰성 검사(T번호)·카드덱 검사(D번호)와 섞이지 않도록 `O` 로 시작합니다.
 * 오버레이는 카드덱과 달리 FACT 를 만들 수 있으므로, 여기서 지키는 것은
 * "근거 없이 사실이 되지 않는가"와 "빈칸이 조용히 사라지지 않는가"입니다.
 *
 * 실행: node --test "tests/*.test.ts"
 */

import test from "node:test";
import assert from "node:assert/strict";

import { listOverlayIds, loadOverlay, loadSectionText } from "../src/overlay/load.ts";
import { deriveRowStatus, OVERLAY_STATUS_CLAIM } from "../src/domain/overlay.ts";
import { renderOverlayPage } from "../src/render/overlayPage.ts";
import { canSupportFact, normalizeForQuoteMatch, sourceCoversScope } from "../src/domain/rules.ts";
import { escapeHtml } from "../src/render/deckPage.ts";
import { loadPack } from "../src/pack/load.ts";

const ids = listOverlayIds();
const overlays = ids.map((id) => loadOverlay(id));

test("O1 오버레이가 최소 한 개 있고 모두 읽힌다", () => {
  assert.ok(ids.length >= 1, "seed/ 아래에 overlay.json 을 가진 폴더가 없습니다.");
  assert.equal(overlays.length, ids.length);
});

for (const overlay of overlays) {
  const id = overlay.meta.id;

  test(`[${id}] O2 모든 Claim 이 회사 특정이고 FACT 는 직접 근거를 가진다`, () => {
    assert.ok(overlay.claims.length > 0, "Claim 이 하나도 없습니다.");
    for (const c of overlay.claims) {
      assert.equal(c.scope, "COMPANY", `${c.id} 의 범위`);
      if (c.assertion_status === "FACT") {
        assert.ok(c.evidence.length >= 1, `${c.id} 에 직접 근거가 없습니다.`);
      }
    }
  });

  test(`[${id}] O3 근거 출처가 회사 특정 사실을 지지할 수 있다`, () => {
    for (const s of overlay.sources) {
      assert.ok(canSupportFact(s), `${s.id} 는 스냅샷·해시가 없어 FACT 의 근거가 될 수 없습니다.`);
      assert.ok(sourceCoversScope(s, "COMPANY"), `${s.id} 가 회사 범위를 덮지 못합니다.`);
      assert.notEqual(s.trust_grade, "D", `${s.id} 등급`);
    }
  });

  test(`[${id}] O4 모든 인용문이 지정한 섹션의 원문에 실제로 존재한다`, () => {
    let checked = 0;
    for (const s of overlay.sources) {
      const file = s.snapshot.pages_text_file;
      assert.ok(file, `${s.id} 에 섹션 원문 파일이 없습니다.`);
      const doc = loadSectionText(id, file);

      assert.equal(doc.sha256, s.snapshot.sha256, `${s.id} 의 스냅샷 해시가 섹션 파일과 다릅니다.`);

      for (const span of overlay.evidenceSpans.filter((x) => x.source_id === s.id)) {
        const raw = doc.pages[String(span.page)];
        assert.ok(raw, `${span.id} 가 가리키는 섹션 ${span.page} 가 없습니다.`);
        assert.ok(
          normalizeForQuoteMatch(raw).includes(normalizeForQuoteMatch(span.quote)),
          `${span.id} 의 인용문을 섹션 ${span.page} 에서 찾을 수 없습니다:\n  ${span.quote.slice(0, 80)}…`,
        );
        checked++;
      }
    }
    assert.ok(checked >= 1, "대조한 인용문이 없습니다.");
  });

  test(`[${id}] O5 행의 상태는 적는 값이 아니라 계산값이다`, () => {
    for (const row of overlay.rows) {
      assert.equal(row.status, deriveRowStatus(row), `행 ${row.id}`);
      const axis = OVERLAY_STATUS_CLAIM[row.status];
      assert.equal(axis.scope, "COMPANY", `행 ${row.id} 의 범위는 언제나 회사 특정이어야 합니다.`);
    }
  });

  test(`[${id}] O6 근거 없는 행이 회사 확인으로 보이지 않는다`, () => {
    for (const row of overlay.rows) {
      if (row.companyClaimIds.length === 0) {
        assert.equal(row.status, "UNVERIFIED", `행 ${row.id} 이 근거 없이 사실로 보입니다.`);
      }
      if (row.status === "FACT") {
        assert.ok(row.claims.length >= 1, `행 ${row.id}`);
        for (const c of row.claims) {
          assert.equal(c.assertion_status, "FACT", `행 ${row.id} 의 Claim ${c.id}`);
          assert.ok(c.evidence.length >= 1, `행 ${row.id} 의 Claim ${c.id} 에 근거가 없습니다.`);
        }
      }
    }
  });

  test(`[${id}] O7 미확인 행이 전부 질문으로 전환되고 역추적된다`, () => {
    const unverified = overlay.rows.filter((r) => r.status === "UNVERIFIED");
    assert.ok(unverified.length >= 1, "미확인 행이 하나도 없습니다. 실제로 그런지 확인하십시오.");

    const rowIds = new Set(overlay.rows.map((r) => r.id));
    for (const row of unverified) {
      const q = overlay.questions.find((x) => x.id === row.questionId);
      assert.ok(q, `행 ${row.id} 이 질문으로 전환되지 않았습니다.`);
      assert.equal(q.fromRow, row.id, `질문 ${q.id} 이 다른 행을 가리킵니다.`);
    }
    for (const q of overlay.questions) {
      assert.ok(rowIds.has(q.fromRow), `질문 ${q.id} 의 출발 행이 없습니다.`);
    }
  });

  test(`[${id}] O8 산업 카드는 비교 기준일 뿐 근거로 쓰이지 않는다`, () => {
    const pack = loadPack(overlay.meta.packId);
    const cardIds = new Set(pack.cards.map((c) => c.id));

    for (const row of overlay.rows) {
      assert.equal(row.industry.packId, overlay.meta.packId, `행 ${row.id} 의 팩`);
      if (row.industry.cardId) {
        assert.ok(cardIds.has(row.industry.cardId), `행 ${row.id} → 없는 카드 ${row.industry.cardId}`);
      } else {
        assert.ok(row.industry.conceptId, `행 ${row.id} 에 카드도 개념도 없습니다.`);
      }
      /* 산업 문장이 Claim 목록에 들어가 있으면 근거로 새어 든 것입니다. */
      for (const c of overlay.claims) {
        assert.notEqual(c.text, row.industry.statement, `행 ${row.id} 의 산업 문장이 Claim 이 되었습니다.`);
      }
    }
  });

  test(`[${id}] O9 회계처리 판단이나 감사 결론을 말하지 않는다`, () => {
    const forbidden = ["적정하다", "부적정", "감사의견", "위반이다", "타당하다", "문제가 있다"];
    const texts = [
      ...overlay.claims.map((c) => c.text),
      ...overlay.rows.map((r) => r.conflict ?? ""),
      overlay.profile.headline,
    ];
    for (const t of texts) {
      for (const w of forbidden) {
        assert.ok(!t.includes(w), `판단 표현 "${w}" 가 있습니다: ${t.slice(0, 60)}…`);
      }
    }
  });

  /* ---------- 화면(문자열) 검사 ---------- */

  const html = renderOverlayPage({ overlay, evidence: new Map(), deckLink: "deck.html" });

  test(`[${id}] O10 카드 세 장과 모든 행·질문이 화면에 있다`, () => {
    for (const cardId of ["CO-01", "CO-02", "CO-03"]) {
      assert.ok(html.includes(`id="${cardId}"`), `${cardId} 가 없습니다.`);
    }
    for (const row of overlay.rows) {
      assert.ok(html.includes(`id="row-${row.id}"`), `행 ${row.id} 마크업이 없습니다.`);
      assert.ok(html.includes(escapeHtml(row.topic)), `행 ${row.id} 제목이 없습니다.`);
    }
    for (const q of overlay.questions) {
      assert.ok(html.includes(`id="q-${q.id}"`), `질문 ${q.id} 마크업이 없습니다.`);
    }
  });

  test(`[${id}] O11 상태 배지가 색이 아니라 글자로 구분되고, 질문에서 행으로 되돌아간다`, () => {
    const used = new Set(overlay.rows.map((r) => r.status));
    for (const s of used) {
      assert.ok(html.includes(`class="tag st-${s}"`), `${s} 배지 클래스가 없습니다.`);
    }
    for (const q of overlay.questions) {
      assert.ok(
        html.includes(`data-jump="row-${q.fromRow}"`),
        `질문 ${q.id} 에서 행 ${q.fromRow} 으로 되돌아가는 링크가 없습니다.`,
      );
      assert.ok(html.includes(`data-jump="q-${q.id}"`), `행 → 질문 링크가 없습니다: ${q.id}`);
    }
  });

  test(`[${id}] O12 두 층이 화면에서 갈라져 보이고 한계가 고정으로 있다`, () => {
    assert.ok(html.includes("여기서부터는 회사 층입니다"), "층 구분 안내가 없습니다.");
    assert.ok(html.includes("비교 기준입니다. 이 회사의 근거가 아닙니다."), "비교 기준 표기가 없습니다.");
    assert.ok(html.includes("<footer>"), "푸터가 없습니다.");
    for (const limit of overlay.meta.limits) {
      assert.ok(html.includes(escapeHtml(limit)), `한계 문장이 빠졌습니다: ${limit.slice(0, 30)}…`);
    }
  });
}
