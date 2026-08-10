/**
 * 근거 후보 찾기 검사.
 *
 * 실제 원문(IATA BSP 매뉴얼 스냅샷)을 상대로 검사합니다.
 * 이미 사람이 확정해 둔 근거(EV-007, EV-010 등)가 있는 페이지를 후보로 찾아내는지 확인하면,
 * 나중에 DART 공시 원문에 같은 방식을 적용했을 때 동작하리라 볼 수 있습니다.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { loadPageText, loadSeed, byId } from "../src/seed/load.ts";
import { collapseWhitespace, findCandidates } from "../src/ingest/candidates.ts";

const seed = loadSeed();
const spans = byId(seed.evidenceSpans);
const bsp = loadPageText("iata-bsp-manual-for-agents-2021-09-01.pages.json");

test("I1 사람이 확정한 근거가 있는 페이지를 후보로 찾아낸다", () => {
  const found = findCandidates(bsp.pages, ["Financial Security"], { maxPerPageTerm: 10 });
  const pagesFound = new Set(found.map((c) => c.page));

  // EV-007(p.18)과 EV-010(p.62)은 사람이 이미 확정한 담보 관련 근거입니다.
  for (const spanId of ["EV-007", "EV-010"]) {
    const span = spans.get(spanId)!;
    assert.ok(pagesFound.has(span.page), `${spanId} 이 있는 ${span.page}쪽을 후보로 찾지 못했습니다`);
  }
});

test("I2 후보에 찾은 낱말이 실제로 들어 있다", () => {
  const found = findCandidates(bsp.pages, ["Remittance Holding Capacity", "Clearing Bank"]);
  assert.ok(found.length > 0);
  for (const c of found) {
    assert.ok(
      c.snippet.toLowerCase().includes(collapseWhitespace(c.term).toLowerCase()),
      `${c.page}쪽 후보에 "${c.term}" 이 없습니다: ${c.snippet}`,
    );
  }
});

test("I3 같은 입력에는 항상 같은 결과가 나온다", () => {
  const a = findCandidates(bsp.pages, ["Financial Security", "Cash Facility"]);
  const b = findCandidates(bsp.pages, ["Financial Security", "Cash Facility"]);
  assert.deepEqual(a, b);
});

test("I4 결과가 페이지 순서대로 정렬된다", () => {
  const found = findCandidates(bsp.pages, ["Financial Security"], { maxPerPageTerm: 10 });
  const pages = found.map((c) => c.page);
  assert.deepEqual(
    pages,
    [...pages].sort((x, y) => x - y),
  );
});

test("I5 한 페이지에서 같은 낱말을 가져오는 건수를 제한한다", () => {
  const found = findCandidates(bsp.pages, ["Agent"], { maxPerPageTerm: 2 });
  const counts = new Map<string, number>();
  for (const c of found) {
    const key = c.page + "|" + c.term;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [key, n] of counts) {
    assert.ok(n <= 2, `${key} 에서 ${n}건이 나왔습니다`);
  }
});

test("I6 없는 낱말은 후보를 만들지 않는다", () => {
  assert.deepEqual(findCandidates(bsp.pages, ["존재하지않는낱말XYZ"]), []);
});

test("I7 후보는 아무 상태도 갖지 않는다 (Claim이 아니다)", () => {
  const found = findCandidates(bsp.pages, ["Financial Security"]);
  assert.ok(found.length > 0);
  for (const c of found) {
    assert.deepEqual(Object.keys(c).sort(), ["offset", "page", "snippet", "term"]);
  }
});

test("I8 한국어 검색어도 같은 방식으로 동작한다", () => {
  const kifrs = loadPageText("kifrs1115-principal-agent-agenda-decision-2022-05.pages.json");
  const found = findCandidates(kifrs.pages, ["대리인", "통제"], { maxPerPageTerm: 2 });
  assert.ok(found.length > 0, "한국어 원문에서 후보를 찾지 못했습니다");
  assert.ok(
    found.some((c) => c.page === 2 || c.page === 3),
    "본인·대리인 판단이 있는 2~3쪽을 찾지 못했습니다",
  );
});
