/**
 * 카드덱(팩)의 무결성과 화면 규칙 검사.
 *
 * 실행: node --test "tests/*.test.ts"
 *
 * 화면 검사는 생성된 HTML 문자열에 대한 마크업 검사입니다. 브라우저 e2e 가 아닙니다
 * (docs/decisions/0006-static-render-instead-of-nextjs.md).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { listPackIds, loadPack, orphanCardIds } from "../src/pack/load.ts";
import { escapeHtml, jsonForScript, renderDeckPage } from "../src/render/deckPage.ts";
import {
  BODY_TEXT_MAX,
  BODY_TEXT_MIN,
  CARD_AXIS_CLAIM,
  CARD_AXIS_LABEL_KO,
  NEXT_MAX,
  NEXT_MIN,
  REFERENCE_TRACKS,
  TABLE_DATA_ROW_MAX,
  TABLE_MAX,
  TERMS_MAX,
  TERMS_MIN,
  bodyTextLength,
  disallowedBodyMarkup,
  tableStats,
} from "../src/domain/pack.ts";
import type { Pack } from "../src/domain/pack.ts";

const packIds = listPackIds();
const packs: Pack[] = packIds.map((id) => loadPack(id));

test("팩이 최소 한 개 있고, 모두 읽힌다", () => {
  assert.ok(packIds.length >= 1, "packs/ 아래에 팩이 없습니다.");
  assert.equal(packs.length, packIds.length);
});

test("조선업 팩은 카드 26장이다", () => {
  const pack = packs.find((p) => p.meta.id === "shipbuilding");
  assert.ok(pack, "shipbuilding 팩이 없습니다.");
  assert.equal(pack.cards.length, 26);
});

test("script 안에 넣는 JSON 은 태그를 일찍 닫지 못한다", () => {
  const hostile = { text: "</script><!-- 주석 --><script>alert(1)</script>", sep: "\u2028\u2029" };
  const injected = jsonForScript(hostile);

  assert.ok(!injected.includes("<"), "< 가 그대로 남아 있습니다.");
  assert.ok(!injected.includes(">"), "> 가 그대로 남아 있습니다.");
  assert.ok(!injected.includes("\u2028") && !injected.includes("\u2029"), "줄 구분자가 남아 있습니다.");
  assert.deepEqual(JSON.parse(injected), hostile, "이스케이프 뒤에도 값은 같아야 합니다.");
});

test("화면에 나가는 글자는 HTML 이스케이프된다", () => {
  assert.equal(escapeHtml('<b class="x">&\'</b>'), "&lt;b class=&quot;x&quot;&gt;&amp;&#39;&lt;/b&gt;");
});

for (const pack of packs) {
  const id = pack.meta.id;

  test(`[${id}] 카드 id 가 유일하다`, () => {
    const ids = pack.cards.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(
      ids.every((cardId) => cardId.length > 0),
      "id 가 빈 카드가 있습니다.",
    );
  });

  test(`[${id}] "이어서 볼 것" 링크가 전부 존재하는 카드를 가리킨다`, () => {
    const ids = new Set(pack.cards.map((c) => c.id));
    for (const card of pack.cards) {
      for (const link of card.next) {
        assert.ok(ids.has(link.to), `카드 ${card.id} → ${link.to} 가 없습니다.`);
      }
    }
  });

  test(`[${id}] D7 질문 칩은 카드마다 ${NEXT_MIN}~${NEXT_MAX}개다`, () => {
    for (const card of pack.cards) {
      assert.ok(
        card.next.length >= NEXT_MIN && card.next.length <= NEXT_MAX,
        `카드 ${card.id} 의 "이어서 볼 것"이 ${card.next.length}개입니다.`,
      );
    }
  });

  test(`[${id}] 유입 링크가 0인 카드가 없다`, () => {
    const orphans = orphanCardIds(pack.meta, pack.cards, pack.fieldMatrix);
    assert.deepEqual(orphans, [], `아무도 가리키지 않는 카드: ${orphans.join(", ")}`);
  });

  test(`[${id}] 본문에 허용하지 않는 태그와 속성이 없다`, () => {
    for (const card of pack.cards) {
      assert.deepEqual(disallowedBodyMarkup(card.body), [], `카드 ${card.id} 본문`);
    }
  });

  test(`[${id}] 모든 카드에 "이걸 알면 무엇이 달라지나"가 있다`, () => {
    for (const card of pack.cards) {
      assert.ok(card.audit.trim().length > 0, `카드 ${card.id} 의 audit 이 비어 있습니다.`);
    }
  });

  test(`[${id}] D4 본문이 태그 제외 ${BODY_TEXT_MIN}~${BODY_TEXT_MAX}자다`, () => {
    for (const card of pack.cards) {
      const length = bodyTextLength(card.body);
      assert.ok(length >= BODY_TEXT_MIN, `카드 ${card.id} 본문이 ${length}자로 짧습니다.`);
      assert.ok(length <= BODY_TEXT_MAX, `카드 ${card.id} 본문이 ${length}자로 깁니다.`);
    }
  });

  test(`[${id}] D5 표는 카드당 ${TABLE_MAX}개 이하이고 데이터 행이 ${TABLE_DATA_ROW_MAX}행 이하다`, () => {
    for (const card of pack.cards) {
      const { count, maxDataRows } = tableStats(card.body);
      assert.ok(count <= TABLE_MAX, `카드 ${card.id} 에 표가 ${count}개입니다.`);

      // 조회용 트랙은 행수 상한을 면제합니다 — 근거는 src/domain/pack.ts 의 REFERENCE_TRACKS 주석.
      if (REFERENCE_TRACKS.includes(card.track)) continue;
      assert.ok(maxDataRows <= TABLE_DATA_ROW_MAX, `카드 ${card.id} 의 표가 데이터 ${maxDataRows}행입니다.`);
    }
  });

  test(`[${id}] 용어 미니사전이 카드마다 ${TERMS_MIN}~${TERMS_MAX}개다`, () => {
    for (const card of pack.cards) {
      // 조회용 트랙은 카드 자체가 사전이므로 별도 미니사전을 요구하지 않습니다.
      if (REFERENCE_TRACKS.includes(card.track)) continue;
      assert.ok(
        card.terms.length >= TERMS_MIN && card.terms.length <= TERMS_MAX,
        `카드 ${card.id} 의 용어가 ${card.terms.length}개입니다.`,
      );
    }
  });

  test(`[${id}] 카드의 축은 산업 자료를 넘어서지 않는다`, () => {
    for (const card of pack.cards) {
      const claim = CARD_AXIS_CLAIM[card.axis];
      assert.notEqual(claim.assertion, "FACT", `카드 ${card.id} 가 사실로 표시됩니다.`);
      if (claim.scope === "COMPANY") {
        assert.equal(claim.assertion, "UNVERIFIED", `카드 ${card.id} 가 회사 특정을 추정으로 말합니다.`);
      }
    }
  });

  test(`[${id}] 시작 카드와 담당 필드 카드가 실재한다`, () => {
    const ids = new Set(pack.cards.map((c) => c.id));
    assert.ok(ids.has(pack.meta.entryCardId));
    for (const field of pack.fieldMatrix.fields) {
      assert.ok(ids.has(field.card), `필드 ${field.label} → ${field.card}`);
    }
    for (const cardId of pack.fieldMatrix.alwaysCards) {
      assert.ok(ids.has(cardId));
    }
  });

  /* ---------- 화면(문자열) 검사 ---------- */

  const html = renderDeckPage(pack);

  test(`[${id}] 화면에 모든 카드 제목이 들어 있다`, () => {
    for (const card of pack.cards) {
      assert.ok(html.includes(`id="card-${card.id}"`), `카드 ${card.id} 마크업이 없습니다.`);
      assert.ok(html.includes(escapeForCheck(card.title)), `카드 ${card.id} 제목이 없습니다.`);
    }
  });

  test(`[${id}] 축 배지가 색이 아니라 글자로 구분된다`, () => {
    const used = new Set(pack.cards.map((c) => c.axis));
    for (const axis of used) {
      const label = CARD_AXIS_LABEL_KO[axis];
      assert.ok(html.includes(`class="tag axis-${axis}"`), `${axis} 배지 클래스가 없습니다.`);
      assert.ok(html.includes(`${label.mark}</span>${label.label}`), `${axis} 배지 글자가 없습니다.`);
    }
  });

  test(`[${id}] 출처와 시점 한계가 화면 아래에 고정으로 있다`, () => {
    assert.ok(html.includes("<footer>"));
    assert.ok(html.includes("정보 출처와 한계"));
    assert.ok(html.includes(escapeForCheck(pack.meta.source.basis)));
    assert.ok(html.includes(escapeForCheck(pack.meta.source.limitation)));
    assert.ok(html.includes(escapeForCheck(pack.meta.source.asOf)));
  });

  test(`[${id}] 화면 문구에 저장소 내부 참조가 새어 나오지 않는다`, () => {
    // pack.json 의 known_limits 와 위치 안내문은 화면에 그대로 나갑니다.
    // 작성자용 메모(파일 경로·ADR 번호·개념 id)가 섞이면 읽는 사람에게 뜻 없는 글자가 보입니다.
    const 내부표시 = [
      /\.(md|json)\b/,
      /\bADR\s*\d/,
      /\bK-\d\d\b/,
      /\b(known_limits|authoring_notes|always_cards|card_by_field|entry_card|positions|fields)\b/,
    ];
    const 화면문구 = [
      ...pack.meta.source.limits,
      ...pack.fieldMatrix.positions.map((p) => p.note),
      pack.fieldMatrix.note,
      pack.meta.searchNote,
    ];

    for (const 문구 of 화면문구) {
      for (const 표시 of 내부표시) {
        assert.ok(!표시.test(문구), `화면 문구에 내부 참조가 있습니다 (${표시}): ${문구}`);
      }
    }
  });

  test(`[${id}] 주입한 JSON 이 </script> 로 일찍 닫히지 않는다`, () => {
    const closings = html.split("</script>").length - 1;
    const openings = html.split("<script").length - 1;
    assert.equal(closings, openings, "script 태그의 열고 닫는 수가 다릅니다.");
    assert.equal(openings, 2, "script 태그는 데이터 1개와 동작 1개여야 합니다.");

    const dataBlock = html
      .split('<script type="application/json" id="deck-data">')[1]!
      .split("</script>")[0]!;
    assert.ok(!dataBlock.includes("<"), "주입한 JSON 에 < 가 남아 있습니다.");
    assert.ok(!dataBlock.includes("<!--"), "주입한 JSON 에 주석 시작이 있습니다.");

    const data = JSON.parse(dataBlock) as { cards: { id: string; hay: string }[] };
    assert.equal(data.cards.length, pack.cards.length);
    assert.ok(!data.cards.some((c) => c.hay.includes("<")), "검색 색인에 태그가 남아 있습니다.");
  });

  test(`[${id}] 시작 화면에 회사명·밸류체인 위치·담당 필드가 모두 있다`, () => {
    assert.ok(html.includes('id="co"'), "회사명 입력이 없습니다.");
    for (const position of pack.fieldMatrix.positions) {
      assert.ok(html.includes(escapeForCheck(position.label)), `위치 ${position.label} 가 없습니다.`);
    }
    for (const field of pack.fieldMatrix.fields) {
      assert.ok(html.includes(`data-card="${field.card}"`), `필드 ${field.label} 가 없습니다.`);
    }
    assert.ok(html.includes('id="go" disabled'), "세 값이 차기 전에는 시작할 수 없어야 합니다.");
  });
}

/** 화면에 나갈 때 이스케이프되는 글자를 검사 문자열에도 똑같이 적용합니다. */
function escapeForCheck(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
