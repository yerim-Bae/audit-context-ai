/**
 * 회사명으로 사업보고서를 찾아 "무엇을 파는 회사인지"만 읽고,
 * 그 산업 밸류체인에서 어디쯤인지를 **제안**합니다.
 *
 * 실행:
 *   npm run company:suggest -- "대양전기공업" --pack shipbuilding
 *   npm run company:suggest -- "한전KPS" --pack nuclear --fetch
 *
 * --fetch 를 붙이면 원문이 없을 때 DART 에서 받아옵니다(ADR 0007, 한 건씩).
 * 이미 받아 둔 회사는 붙이지 않아도 됩니다.
 *
 * 하는 일
 *   1) 회사명 → 고유번호 (corpCode.xml, 30일 캐시)
 *   2) 사업보고서에서 매출·영업부문 섹션만 골라 읽기
 *   3) 팩의 밸류체인 위치 keywords 와 맞춰 **제안** 출력
 *
 * 하지 않는 일
 *   - 위치를 확정하지 않습니다. 근거 문장을 함께 내보내고 사람이 고릅니다.
 *   - Claim 을 만들지 않습니다. 회사 사실은 사람이 원문을 보고 승인해야 합니다.
 *   - 산업(팩)을 추측하지 않습니다. --pack 을 반드시 받습니다.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  DartError,
  decodeDocument,
  fetchCorpCodeXml,
  fetchDocument,
  listFilings,
  readApiKey,
  searchCompanies,
} from "../src/ingest/dart.ts";
import { sectionsAsPages, splitSections } from "../src/ingest/dartDocument.ts";
import { REPO_ROOT } from "../src/seed/load.ts";
import { listPackIds, loadPack } from "../src/pack/load.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf("--" + name);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name: string) => args.includes("--" + name);

/** 플래그와 그 값이 아닌 첫 인자가 회사명입니다. */
function positional(): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      if (a !== "--fetch") i++; // 값을 받는 플래그는 다음 인자를 건너뜁니다.
      continue;
    }
    return a;
  }
  return undefined;
}

const companyName = positional();
const packId = flag("pack");

if (!companyName || !packId) {
  console.error("사용법: npm run company:suggest -- <회사명> --pack <산업>");
  console.error(`쓸 수 있는 산업: ${listPackIds().join(", ")}`);
  process.exit(1);
}
if (!listPackIds().includes(packId)) {
  console.error(`모르는 산업 "${packId}". 쓸 수 있는 값: ${listPackIds().join(", ")}`);
  process.exit(1);
}

/** 회사가 무엇을 파는지가 적히는 절. 여기 밖은 보지 않습니다. */
const BUSINESS_SECTION_PATTERNS = [
  /사업의 (개요|내용)/,
  /매출 및 수주상황/,
  /주요 제품/,
  /영업부문/,
  /사업부문/,
];

interface Hit {
  positionId: string;
  positionLabel: string;
  keyword: string;
  section: number;
  sectionTitle: string;
  quote: string;
}

function excerptAround(text: string, at: number, keyword: string): string {
  const flat = text.replace(/\s+/g, " ");
  const start = Math.max(0, at - 90);
  const end = Math.min(flat.length, at + keyword.length + 130);
  return (start > 0 ? "…" : "") + flat.slice(start, end).trim() + (end < flat.length ? "…" : "");
}

try {
  const pack = loadPack(packId);
  const positions = pack.fieldMatrix.positions;

  if (!positions.some((p) => p.keywords.length > 0)) {
    console.error(`팩 "${packId}" 의 field-matrix.json 에 위치별 keywords 가 없습니다. 먼저 채워 주십시오.`);
    process.exit(1);
  }

  const key = readApiKey();

  /* 1. 회사명 → 고유번호. 회사코드 파일은 .cache/ 에 30일 재사용합니다(dart-find 와 같은 규칙). */
  const cacheDir = join(REPO_ROOT, ".cache");
  const corpCodeFile = join(cacheDir, "corpCode.xml");
  const fresh = existsSync(corpCodeFile) && (Date.now() - statSync(corpCodeFile).mtimeMs) / 86_400_000 < 30;

  let xml: string;
  if (fresh) {
    xml = readFileSync(corpCodeFile, "utf-8");
  } else {
    xml = await fetchCorpCodeXml(key);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(corpCodeFile, xml, "utf-8");
  }

  const corps = searchCompanies(xml, companyName);
  if (corps.length === 0) {
    console.error(`"${companyName}" 으로 찾은 회사가 없습니다. 정식 상호로 다시 시도하십시오.`);
    process.exit(1);
  }
  const corp = corps[0]!;
  if (corps.length > 1) {
    console.log(`같은 이름이 ${corps.length}건입니다. 첫 번째를 씁니다: ${corp.corpName} (${corp.corpCode})`);
    console.log(
      `  나머지: ${corps
        .slice(1, 5)
        .map((c) => `${c.corpName}(${c.corpCode})`)
        .join(", ")}\n`,
    );
  }

  /* 2. 사업보고서 원문 확보 */
  const outDir = join(REPO_ROOT, ".cache", "suggest", corp.corpCode);
  mkdirSync(outDir, { recursive: true });

  const filings = await listFilings(key, corp.corpCode, { bgnDe: "20200101", endDe: "20261231" });
  const target = filings.filter((f) => f.reportName.includes("사업보고서"))[0];
  if (!target) {
    console.error(
      `${corp.corpName}: 사업보고서를 찾지 못했습니다. 비상장이거나 정기공시 대상이 아닐 수 있습니다.`,
    );
    process.exit(1);
  }

  const cached = join(outDir, `${target.receiptNo}.xml`);
  let data: Buffer;
  if (existsSync(cached)) {
    data = readFileSync(cached);
  } else if (has("fetch")) {
    const entries = await fetchDocument(key, target.receiptNo);
    data = entries[0]!.data;
    writeFileSync(cached, data);
  } else {
    console.error(`원문이 아직 없습니다. --fetch 를 붙이면 DART 에서 한 건만 받아옵니다.`);
    console.error(`  대상: ${corp.corpName} / ${target.reportName} / 접수 ${target.receiptDate}`);
    process.exit(1);
  }

  const sha256 = createHash("sha256").update(data).digest("hex");
  const sections = splitSections(decodeDocument(data));
  const pages = sectionsAsPages(sections);

  /* 3. 사업 서술 절만 골라 위치 keywords 와 맞춘다 */
  const businessSections = sections.filter((s) => BUSINESS_SECTION_PATTERNS.some((re) => re.test(s.title)));

  const hits: Hit[] = [];
  for (const section of businessSections) {
    const text = (pages[String(section.index)] ?? "").replace(/\s+/g, " ");
    for (const position of positions) {
      for (const keyword of position.keywords) {
        const at = text.indexOf(keyword);
        if (at === -1) continue;
        hits.push({
          positionId: position.id,
          positionLabel: position.label,
          keyword,
          section: section.index,
          sectionTitle: section.title,
          quote: excerptAround(text, at, keyword),
        });
      }
    }
  }

  /* 점수는 "서로 다른 낱말이 몇 개 걸렸나"입니다. 같은 낱말이 여러 번 나온 것은 세지 않습니다. */
  const score = new Map<string, Set<string>>();
  for (const h of hits) {
    if (!score.has(h.positionId)) score.set(h.positionId, new Set());
    score.get(h.positionId)!.add(h.keyword);
  }
  const ranked = positions
    .map((p) => ({ position: p, words: [...(score.get(p.id) ?? [])] }))
    .sort((a, b) => b.words.length - a.words.length);

  /* ---------- 출력 ---------- */
  console.log(`\n${corp.corpName} (${corp.corpCode})`);
  console.log(`${target.reportName} · 접수 ${target.receiptDate} · 섹션 ${sections.length}`);
  console.log(`sha256 ${sha256.slice(0, 16)}…`);
  console.log(`산업: ${pack.meta.industry}\n`);

  console.log(
    `읽은 절 ${businessSections.length}개 — ${businessSections.map((s) => `§${s.index} ${s.title}`).join(" / ") || "(없음)"}\n`,
  );

  const top = ranked[0];
  if (!top || top.words.length === 0) {
    console.log("밸류체인 위치를 제안할 수 없습니다.");
    console.log("이 산업의 낱말이 사업 서술에 하나도 나오지 않습니다. 다른 산업의 회사이거나,");
    console.log("이 팩이 그 위치를 아직 다루지 않는다는 뜻입니다. 사람이 판단해야 합니다.\n");
  } else {
    console.log("제안 (확정이 아닙니다 — 근거를 보고 사람이 고르십시오)\n");
    for (const r of ranked) {
      const bar = "■".repeat(r.words.length).padEnd(12, "·");
      console.log(
        `  ${bar} ${r.position.label.padEnd(14)} 걸린 낱말 ${r.words.length}개${r.words.length ? " — " + r.words.join(", ") : ""}`,
      );
    }
    const tie = ranked.filter((r) => r.words.length === top.words.length);
    console.log(
      tie.length > 1
        ? `\n  → ${tie.map((t) => t.position.label).join(" 와 ")} 가 같은 점수입니다. 사람이 갈라야 합니다.`
        : `\n  → 가장 가까운 위치: ${top.position.label}`,
    );
  }

  console.log("\n근거 문장 (원문 그대로)\n");
  const shown = new Set<string>();
  for (const h of hits) {
    const dedupe = `${h.positionId}|${h.section}`;
    if (shown.has(dedupe)) continue;
    shown.add(dedupe);
    console.log(`  [${h.positionLabel}] §${h.section} ${h.sectionTitle} — "${h.keyword}"`);
    console.log(`    ${h.quote}\n`);
  }

  console.log("이 제안은 낱말이 몇 개 걸렸는지만 셉니다. 문장의 뜻은 읽지 않습니다.");
  console.log("같은 산업 안에서는 위아래 단이 서로의 낱말을 쓰므로 뒤집히기 쉽습니다");
  console.log("(기자재사도 '조선'을 말하고, 조선사도 '기자재'를 말합니다).");
  console.log("반드시 위 근거 문장을 읽고 사람이 고르십시오.");
  console.log("회사 사실로 쓰려면 원문을 보고 승인해야 합니다(ADR 0007).");
  console.log(
    `오버레이를 만들려면: npm run dart:fetch -- ${corp.corpCode} --out <폴더명> --terms ${packId}\n`,
  );
} catch (e) {
  if (e instanceof DartError) console.error(`DART 오류 [${e.status}] ${e.message}`);
  else console.error(String(e instanceof Error ? e.message : e));
  process.exitCode = 1;
}
