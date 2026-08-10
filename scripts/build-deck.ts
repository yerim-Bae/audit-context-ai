/**
 * packs/ 아래의 온보딩 카드덱을 전부 화면으로 만들어 dist/ 에 씁니다.
 * 팩이 둘 이상이면 dist/decks.html 목록 화면도 함께 만듭니다.
 *
 * 실행: node scripts/build-deck.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { listPackIds, loadPack, REPO_ROOT } from "../src/pack/load.ts";
import { renderDeckIndexPage, renderDeckPage } from "../src/render/deckPage.ts";
import { totalMinutes } from "../src/domain/pack.ts";
import type { Pack } from "../src/domain/pack.ts";

const DIST = join(REPO_ROOT, "dist");

const packIds = listPackIds();
if (packIds.length === 0) {
  console.error("packs/ 아래에 팩이 없습니다. packs/<id>/pack.json 과 cards.json 이 필요합니다.");
  process.exit(1);
}

mkdirSync(DIST, { recursive: true });

const built: Pack[] = [];
for (const id of packIds) {
  const pack = loadPack(id);
  const html = renderDeckPage(pack);
  const file = `deck-${pack.meta.id}.html`;
  writeFileSync(join(DIST, file), html, "utf-8");
  built.push(pack);

  console.log(
    `dist/${file.padEnd(24)} (${(html.length / 1024).toFixed(1)} KB) — ` +
      `${pack.meta.industry} 카드 ${pack.cards.length}장 · 약 ${totalMinutes(pack.cards)}분`,
  );
}

if (built.length > 1) {
  const index = renderDeckIndexPage(built);
  writeFileSync(join(DIST, "decks.html"), index, "utf-8");
  console.log(
    `dist/${"decks.html".padEnd(24)} (${(index.length / 1024).toFixed(1)} KB) — 팩 ${built.length}개 목록`,
  );
}

console.log(`팩 ${built.length}개를 만들었습니다. dist/ 를 열어 확인하십시오.`);
