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
const html = renderPage(seed, {
  candidatesLink: hasCandidates ? "candidates.html" : undefined,
  companyLink: hasCompany ? "hanatour.html" : undefined,
});
writeFileSync(join(DIST, "index.html"), html, "utf-8");

let copied = 0;
for (const file of readdirSync(SOURCES_DIR)) {
  if (file.endsWith(".pages.json") || file === "manifest.json") continue;
  copyFileSync(join(SOURCES_DIR, file), join(DIST_SOURCES, file));
  copied++;
}
console.log(`dist/index.html      (${(html.length / 1024).toFixed(1)} KB)`);
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
