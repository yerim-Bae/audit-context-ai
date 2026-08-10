/**
 * 지정한 회사의 공시 원문 한 건을 가져와 불변 스냅샷으로 저장하고, 근거 후보를 뽑습니다.
 *
 * 실행:
 *   npm run dart:fetch -- <고유번호> [--report 사업보고서] [--out <폴더명>]
 *   예) npm run dart:fetch -- 00269940 --out hanatour
 *
 * 하는 일:
 *   1) 정기공시 목록에서 최신 보고서 한 건을 고릅니다 (자동 크롤링 아님, 한 건만)
 *   2) 원문 ZIP을 받아 원본 바이트 그대로 저장하고 SHA-256 을 남깁니다
 *   3) 섹션 단위 텍스트로 바꿔 위치를 재현 가능하게 만듭니다
 *   4) 검색어가 나오는 곳을 근거 "후보"로 뽑습니다
 *
 * 하지 않는 일: Claim 생성. 후보는 아무 상태도 갖지 않습니다(ADR 0007).
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DartError, decodeDocument, fetchDocument, listFilings, readApiKey } from "../src/ingest/dart.ts";
import { sectionsAsPages, splitSections } from "../src/ingest/dartDocument.ts";
import { findCandidates, RESTRICTED_DEPOSIT_TERMS, BSP_TERMS } from "../src/ingest/candidates.ts";
import { REPO_ROOT } from "../src/seed/load.ts";

const args = process.argv.slice(2);
const corpCode = args.find((a) => /^\d{8}$/.test(a));
const flag = (name: string) => {
  const i = args.indexOf("--" + name);
  return i === -1 ? undefined : args[i + 1];
};

if (!corpCode) {
  console.error("고유번호(8자리)를 입력하세요. 예: npm run dart:fetch -- 00269940 --out hanatour");
  process.exit(1);
}

const reportKeyword = flag("report") ?? "사업보고서";
const outName = flag("out") ?? corpCode;
const OUT_DIR = join(REPO_ROOT, "seed", outName, "sources");

try {
  const key = readApiKey();

  const filings = await listFilings(key, corpCode, { bgnDe: "20200101", endDe: "20261231" });
  const target = filings.filter((f) => f.reportName.includes(reportKeyword))[0];
  if (!target) {
    console.error(`"${reportKeyword}" 를 포함하는 공시를 찾지 못했습니다.`);
    process.exit(1);
  }

  console.log(`대상: ${target.corpName} / ${target.reportName} / 접수번호 ${target.receiptNo}`);
  console.log(`접수일: ${target.receiptDate}\n`);

  const entries = await fetchDocument(key, target.receiptNo);
  mkdirSync(OUT_DIR, { recursive: true });

  const files: Array<Record<string, unknown>> = [];
  const allCandidates: Array<Record<string, unknown>> = [];

  for (const entry of entries) {
    const sha256 = createHash("sha256").update(entry.data).digest("hex");
    writeFileSync(join(OUT_DIR, entry.name), entry.data);

    const text = decodeDocument(entry.data);
    const sections = splitSections(text);
    const sectionsFile = entry.name.replace(/\.xml$/i, "") + ".sections.json";
    writeFileSync(
      join(OUT_DIR, sectionsFile),
      JSON.stringify(
        {
          source_file: entry.name,
          sha256,
          section_count: sections.length,
          parser: "splitSections (TITLE 기준)",
          pages: sectionsAsPages(sections),
          titles: Object.fromEntries(sections.map((s) => [String(s.index), s.title])),
        },
        null,
        1,
      ),
      "utf-8",
    );

    files.push({
      file: entry.name,
      sha256,
      bytes: entry.data.length,
      sections: sections.length,
      sections_file: sectionsFile,
    });

    const hits = findCandidates(sectionsAsPages(sections), [...RESTRICTED_DEPOSIT_TERMS, ...BSP_TERMS], {
      maxPerPageTerm: 2,
      window: 220,
    });
    for (const h of hits) {
      allCandidates.push({
        file: entry.name,
        section: h.page,
        section_title: sections.find((s) => s.index === h.page)?.title ?? "",
        term: h.term,
        snippet: h.snippet.replace(/\s+/g, " ").trim(),
        review_status: "PENDING",
      });
    }

    console.log(
      `${entry.name}  ${entry.data.length.toLocaleString()} bytes  섹션 ${sections.length}  후보 ${hits.length}`,
    );
    console.log(`  sha256 ${sha256}`);
  }

  const manifest = {
    corp_code: corpCode,
    corp_name: target.corpName,
    report_name: target.reportName,
    receipt_no: target.receiptNo,
    receipt_date: target.receiptDate,
    url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${target.receiptNo}`,
    fetched_at: new Date().toISOString().slice(0, 10),
    trust_grade: "A",
    can_support_scope: ["INDUSTRY", "COMPANY", "PERIOD"],
    files,
    note: "DART 전자공시 원문. 회사 특정 근거로 쓸 수 있습니다(ADR 0007).",
  };
  writeFileSync(join(OUT_DIR, "dart-manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

  writeFileSync(
    join(OUT_DIR, "candidates.json"),
    JSON.stringify(
      {
        $comment:
          "근거 후보입니다. Claim이 아니며 아무 상태도 갖지 않습니다. 사람이 원문을 보고 확정해야 근거가 됩니다.",
        receipt_no: target.receiptNo,
        generated_at: new Date().toISOString().slice(0, 10),
        candidates: allCandidates,
      },
      null,
      1,
    ),
    "utf-8",
  );

  console.log(`\n스냅샷과 후보를 저장했습니다: seed/${outName}/sources/`);
  console.log(`근거 후보 ${allCandidates.length}건 — 사람 검토 대기(PENDING)`);
} catch (e) {
  if (e instanceof DartError) console.error(`DART 오류 [${e.status}] ${e.message}`);
  else console.error(String(e instanceof Error ? e.message : e));
  process.exitCode = 1;
}
