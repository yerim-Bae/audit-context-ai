/**
 * 회사명으로 DART 고유번호를 찾습니다.
 *
 * 실행: npm run dart:find -- 하나투어
 *
 * 회사코드 파일은 용량이 커서 .cache/ 에 한 번 받아 두고 재사용합니다.
 * 이 단계는 아무 Claim도 만들지 않습니다. 어떤 회사의 원문을 볼지 정하기만 합니다.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DartError, fetchCorpCodeXml, readApiKey, searchCompanies } from "../src/ingest/dart.ts";
import { REPO_ROOT } from "../src/seed/load.ts";

const CACHE_DIR = join(REPO_ROOT, ".cache");
const CORP_CODE_FILE = join(CACHE_DIR, "corpCode.xml");
const MAX_AGE_DAYS = 30;

const name = process.argv.slice(2).join(" ").trim();
if (!name) {
  console.error('회사명을 입력하세요. 예: npm run dart:find -- "하나투어"');
  process.exit(1);
}

function cacheIsFresh(): boolean {
  if (!existsSync(CORP_CODE_FILE)) return false;
  const ageDays = (Date.now() - statSync(CORP_CODE_FILE).mtimeMs) / 86_400_000;
  return ageDays < MAX_AGE_DAYS;
}

try {
  const key = readApiKey();

  let xml: string;
  if (cacheIsFresh()) {
    xml = readFileSync(CORP_CODE_FILE, "utf-8");
    console.log(".cache/corpCode.xml 을 사용합니다.");
  } else {
    console.log("DART에서 회사코드 목록을 받는 중입니다 (처음 한 번, 잠시 걸립니다)...");
    xml = await fetchCorpCodeXml(key);
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CORP_CODE_FILE, xml, "utf-8");
    console.log(`.cache/corpCode.xml 저장 (${(xml.length / 1_048_576).toFixed(1)} MB)`);
  }

  const hits = searchCompanies(xml, name);
  if (hits.length === 0) {
    console.log(`"${name}" 으로 찾은 회사가 없습니다.`);
    process.exit(0);
  }

  console.log(`\n"${name}" 검색 결과 ${hits.length}건 (상장사 먼저)\n`);
  console.log("고유번호     종목코드   회사명");
  console.log("─".repeat(60));
  for (const c of hits) {
    console.log(`${c.corpCode}   ${(c.stockCode || "-").padEnd(8)}   ${c.corpName}`);
  }
  console.log("\n다음 단계: npm run dart:fetch -- <고유번호>");
} catch (e) {
  if (e instanceof DartError) console.error(`DART 오류 [${e.status}] ${e.message}`);
  else console.error(String(e instanceof Error ? e.message : e));
  process.exitCode = 1;
}
