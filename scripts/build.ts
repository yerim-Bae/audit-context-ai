/**
 * 시드 데이터로 화면을 만들어 dist/ 에 씁니다.
 * 원문 파일도 함께 복사해, 근거를 누르면 실제 원문이 열리게 합니다.
 *
 * 실행: npm run build
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadSeed, REPO_ROOT, SOURCES_DIR } from "../src/seed/load.ts";
import { renderPage } from "../src/render/page.ts";
import { renderHomePage } from "../src/render/homePage.ts";
import { listPackIds, loadPack } from "../src/pack/load.ts";
import { listOverlayIds, loadOverlay } from "../src/overlay/load.ts";
import { renderCandidatesPage } from "../src/render/candidatesPage.ts";
import type { CandidateRow, DartManifest } from "../src/render/candidatesPage.ts";
import { renderCompanyPage } from "../src/render/companyPage.ts";
import { loadCompanySeed } from "../src/seed/loadCompany.ts";

const DIST = join(REPO_ROOT, "dist");
const DIST_SOURCES = join(DIST, "sources");
const DART_SOURCES = join(REPO_ROOT, "seed", "hanatour", "sources");

mkdirSync(DIST_SOURCES, { recursive: true });

/* 1. 거래 지도 */
const seed = loadSeed();
const hasCandidates = existsSync(join(DART_SOURCES, "candidates.json"));
const hasCompany = existsSync(join(REPO_ROOT, "seed", "hanatour", "claims.json"));
/* 산업 카드덱·회사 오버레이는 이 화면과 다른 자산입니다. 섞지 않고 링크로만 잇습니다. */
const deckLinks = listPackIds().map((id) => {
  const pack = loadPack(id);
  return { label: pack.meta.industry, href: `deck-${pack.meta.id}.html` };
});
const overlayLinks = listOverlayIds().map((id) => {
  const overlay = loadOverlay(id);
  return { label: overlay.meta.companyName, href: `overlay-${overlay.meta.id}.html` };
});

const html = renderPage(seed, {
  candidatesLink: hasCandidates ? "candidates.html" : undefined,
  companyLink: hasCompany ? "hanatour.html" : undefined,
  deckLinks,
  overlayLinks,
});
writeFileSync(join(DIST, "travel-bsp.html"), html, "utf-8");

let copied = 0;
for (const file of readdirSync(SOURCES_DIR)) {
  if (file.endsWith(".pages.json") || file === "manifest.json") continue;
  copyFileSync(join(SOURCES_DIR, file), join(DIST_SOURCES, file));
  copied++;
}
console.log(`dist/travel-bsp.html (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`dist/sources/        원문 ${copied}개 복사`);

/* 2. 근거 후보 검토 화면 (DART 원문을 가져온 경우에만) */
if (hasCandidates) {
  const manifest = JSON.parse(
    readFileSync(join(DART_SOURCES, "dart-manifest.json"), "utf-8"),
  ) as DartManifest;
  const { candidates } = JSON.parse(readFileSync(join(DART_SOURCES, "candidates.json"), "utf-8")) as {
    candidates: CandidateRow[];
  };

  const page = renderCandidatesPage(manifest, candidates);
  writeFileSync(join(DIST, "candidates.html"), page, "utf-8");

  let sectionFiles = 0;
  for (const f of manifest.files) {
    const from = join(DART_SOURCES, f.sections_file);
    if (!existsSync(from)) continue;
    copyFileSync(from, join(DIST_SOURCES, f.sections_file));
    sectionFiles++;
  }

  console.log(`dist/candidates.html (${(page.length / 1024).toFixed(1)} KB) — 후보 ${candidates.length}건`);
  console.log(`dist/sources/        섹션 원문 ${sectionFiles}개 복사`);
}

/* 3. 실제 회사 사례 화면 */
if (hasCompany) {
  const company = loadCompanySeed("hanatour");
  const page = renderCompanyPage(company, {
    candidatesLink: hasCandidates ? "candidates.html" : undefined,
  });
  writeFileSync(join(DIST, "hanatour.html"), page, "utf-8");
  console.log(
    `dist/hanatour.html   (${(page.length / 1024).toFixed(1)} KB) — 회사 특정 사실 ${company.claims.length}건`,
  );
}

/* 4. 첫 화면. 자산이 셋이라 입구가 흩어져 있으므로 여기서 한 곳으로 모읍니다. */
const home = renderHomePage({
  industries: [
    ...deckLinks.map((d) => ({
      label: d.label,
      href: d.href,
      kind: "카드덱" as const,
      detail: "산업 구조를 카드로 읽고, 담당 필드에 필요한 만큼만 엽니다.",
    })),
    {
      label: "여행업",
      href: "travel-bsp.html",
      kind: "거래 지도" as const,
      detail: "항공권 BSP 정산의 거래 흐름과 위험·요청자료·질문을 잇는 화면입니다. 가상 회사 사례입니다.",
    },
  ],
  companies: overlayLinks.map((o) => ({
    label: o.label,
    href: o.href,
    detail: "산업 표준과 다른 점 · 물어볼 것",
  })),
  tools: [
    ...(hasCompany ? [{ label: "하나투어 공시로 확인한 사실", href: "hanatour.html" }] : []),
    ...(hasCandidates ? [{ label: "근거 후보 검토", href: "candidates.html" }] : []),
  ],
});
writeFileSync(join(DIST, "index.html"), home, "utf-8");
console.log(`dist/index.html      (${(home.length / 1024).toFixed(1)} KB) — 첫 화면`);
