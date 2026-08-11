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
import type { IndustryOption, OverlayLink } from "../src/render/deckPage.ts";
import { totalMinutes } from "../src/domain/pack.ts";
import type { Pack } from "../src/domain/pack.ts";
import { listOverlayIds, loadOverlay } from "../src/overlay/load.ts";

/* 이 팩에 회사 층이 준비된 회사. 없으면 빈 배열이고 카드덱은 그대로 동작합니다. */
const overlaysByPack = new Map<string, OverlayLink[]>();
for (const overlayId of listOverlayIds()) {
  const overlay = loadOverlay(overlayId);
  const list = overlaysByPack.get(overlay.meta.packId) ?? [];
  list.push({
    id: overlay.meta.id,
    companyName: overlay.meta.companyName,
    positionLabel: overlay.profile.positionLabel,
    href: `overlay-${overlay.meta.id}.html`,
  });
  overlaysByPack.set(overlay.meta.packId, list);
}

const DIST = join(REPO_ROOT, "dist");

const packIds = listPackIds();
if (packIds.length === 0) {
  console.error("packs/ 아래에 팩이 없습니다. packs/<id>/pack.json 과 cards.json 이 필요합니다.");
  process.exit(1);
}

mkdirSync(DIST, { recursive: true });

/* 드롭다운에 넣을 산업 목록. 자료를 넣은 팩만 들어갑니다. */
const loaded = packIds.map((id) => loadPack(id));
const industries: IndustryOption[] = loaded.map((p) => ({
  id: p.meta.id,
  label: p.meta.industry,
  cards: p.cards.length,
  minutes: totalMinutes(p.cards),
}));

const built: Pack[] = [];
for (const pack of loaded) {
  const html = renderDeckPage(pack, {
    overlays: overlaysByPack.get(pack.meta.id) ?? [],
    industries,
  });
  const file = `deck-${pack.meta.id}.html`;
  writeFileSync(join(DIST, file), html, "utf-8");
  built.push(pack);

  console.log(
    `dist/${file.padEnd(24)} (${(html.length / 1024).toFixed(1)} KB) — ` +
      `${pack.meta.industry} 카드 ${pack.cards.length}장 · 약 ${totalMinutes(pack.cards)}분`,
  );
}

/* 산업 고르기 화면은 팩이 하나여도 만듭니다. 이 화면이 카드덱 쪽 입구입니다. */
const extraLinks = [...overlaysByPack.values()].flat().map((o) => ({
  label: `${o.companyName} 회사 차이표`,
  href: o.href,
}));
const index = renderDeckIndexPage(built, extraLinks);
writeFileSync(join(DIST, "decks.html"), index, "utf-8");
console.log(
  `dist/${"decks.html".padEnd(24)} (${(index.length / 1024).toFixed(1)} KB) — 산업 고르기 (${built.length}개)`,
);

console.log(`팩 ${built.length}개를 만들었습니다. dist/ 를 열어 확인하십시오.`);
