/**
 * seed/ 아래의 회사 오버레이를 전부 화면으로 만들어 dist/ 에 씁니다.
 *
 * 실행: node scripts/build-overlay.ts
 *
 * 근거를 눌렀을 때 열릴 원문은 sections.json 에서 인용문 주변만 잘라 페이지에 넣습니다.
 * 원문 전체(4~5MB)를 dist 로 복사하지 않고도 "인용문이 실제 원문의 어디에 있는지"를
 * 화면에서 확인할 수 있게 하기 위해서입니다.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "../src/seed/load.ts";
import { listOverlayIds, loadOverlay, loadSectionText } from "../src/overlay/load.ts";
import { renderOverlayPage } from "../src/render/overlayPage.ts";
import type { EvidenceView } from "../src/render/overlayPage.ts";
import { normalizeForQuoteMatch } from "../src/domain/rules.ts";

const DIST = join(REPO_ROOT, "dist");
const EXCERPT_BEFORE = 260;
const EXCERPT_AFTER = 700;

const ids = listOverlayIds();
if (ids.length === 0) {
  console.error("seed/ 아래에 overlay.json 을 가진 폴더가 없습니다.");
  process.exit(1);
}

mkdirSync(DIST, { recursive: true });

/** 인용문이 섹션 원문의 어디에 있는지 찾아 앞뒤를 함께 잘라 냅니다. */
function excerptAround(sectionText: string, quote: string): string {
  const flat = sectionText.replace(/\s+/g, " ").trim();

  /* 공백을 지운 문자열에서 위치를 찾고, 원래 문자열의 위치로 되돌립니다. */
  const normFlat = normalizeForQuoteMatch(flat);
  const normQuote = normalizeForQuoteMatch(quote);
  const normAt = normFlat.indexOf(normQuote);
  if (normAt === -1) return flat.slice(0, EXCERPT_BEFORE + EXCERPT_AFTER) + " …";

  /* 정규화 문자열의 인덱스 → 원본 인덱스. 지워진 글자를 세면서 되짚습니다. */
  let kept = 0;
  let at = 0;
  for (; at < flat.length; at++) {
    if (normalizeForQuoteMatch(flat[at]!).length > 0) {
      if (kept === normAt) break;
      kept++;
    }
  }

  const start = Math.max(0, at - EXCERPT_BEFORE);
  const end = Math.min(flat.length, at + quote.length + EXCERPT_AFTER);
  return (start > 0 ? "… " : "") + flat.slice(start, end) + (end < flat.length ? " …" : "");
}

for (const id of ids) {
  const overlay = loadOverlay(id);
  const sourceById = new Map(overlay.sources.map((s) => [s.id, s]));

  /* 근거가 가리키는 sections.json 을 출처별로 한 번만 읽습니다. */
  const textCache = new Map<string, ReturnType<typeof loadSectionText>>();
  const evidence = new Map<string, EvidenceView>();

  for (const span of overlay.evidenceSpans) {
    const source = sourceById.get(span.source_id);
    if (!source) continue;
    const file = source.snapshot.pages_text_file;
    if (!file) continue;

    if (!textCache.has(file)) textCache.set(file, loadSectionText(id, file));
    const doc = textCache.get(file)!;
    const sectionText = doc.pages[String(span.page)] ?? "";

    evidence.set(span.id, {
      span,
      sectionExcerpt: excerptAround(sectionText, span.quote),
      sourceUrl: source.url,
      sourceTitle: source.title,
    });
  }

  const html = renderOverlayPage({
    overlay,
    evidence,
    deckLink: `deck-${overlay.meta.packId}.html`,
  });

  const file = `overlay-${overlay.meta.id}.html`;
  writeFileSync(join(DIST, file), html, "utf-8");

  const counts = {
    fact: overlay.rows.filter((r) => r.status === "FACT").length,
    conflict: overlay.rows.filter((r) => r.status === "CONFLICTING").length,
    unverified: overlay.rows.filter((r) => r.status === "UNVERIFIED").length,
  };
  console.log(
    `dist/${file.padEnd(32)} (${(html.length / 1024).toFixed(1)} KB) — ` +
      `${overlay.meta.companyName} · 차이표 ${overlay.rows.length}행 ` +
      `(확인 ${counts.fact} / 다름 ${counts.conflict} / 미확인 ${counts.unverified}) · 질문 ${overlay.questions.length}건`,
  );
}

console.log(`오버레이 ${ids.length}개를 만들었습니다. dist/ 를 열어 확인하십시오.`);
