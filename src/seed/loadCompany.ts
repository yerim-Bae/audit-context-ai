/**
 * 회사 사례(실제 회사) 로더.
 *
 * 가상 여행사 사례(CASE-001)와 **분리된 경로**로 읽습니다.
 * 두 사례의 Claim이 한 목록으로 섞이지 않게 하기 위해서입니다.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "./load.ts";
import type { Claim, EvidenceSpan, PageText, Source } from "../domain/model.ts";

export interface OpenQuestionStatus {
  claim_id: string;
  question: string;
  outcome: "PARTIAL" | "UNRESOLVED" | "RESOLVED";
  resolved: string;
  still_unknown: string;
  next_action: string[];
}

export interface CompanyCase {
  id: string;
  company_name: string;
  is_fictional: boolean;
  industry: string;
  period_start: string;
  period_end: string;
  status: string;
  corp_code: string;
  stock_code: string;
  real_company_policy: { decision: string; consequence: string; adr: string };
  separation: string;
  open_questions_status: OpenQuestionStatus[];
  /** 아직 승인되지 않았지만 사람이 먼저 봐야 할 후보 */
  pending_review_highlight?: {
    title: string;
    section: number;
    section_title: string;
    quote: string;
    context: string;
    why_it_matters: string;
    limits: string;
    status: string;
  };
  search_negative_findings: string[];
  notes: string;
}

export interface CompanySeed {
  dir: string;
  case: CompanyCase;
  sources: Source[];
  evidenceSpans: EvidenceSpan[];
  claims: Claim[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function companyDir(name: string): string {
  return join(REPO_ROOT, "seed", name);
}

export function loadCompanySeed(name: string): CompanySeed {
  const dir = companyDir(name);
  const manifest = readJson<{ sources: Source[]; evidence_spans: EvidenceSpan[] }>(
    join(dir, "sources", "manifest.json"),
  );
  return {
    dir,
    case: readJson<CompanyCase>(join(dir, "case.json")),
    sources: manifest.sources,
    evidenceSpans: manifest.evidence_spans,
    claims: readJson<{ claims: Claim[] }>(join(dir, "claims.json")).claims,
  };
}

/** 섹션별 원문. scripts/dart-fetch.ts 가 만듭니다. */
export function loadCompanySectionText(name: string, fileName: string): PageText {
  return readJson<PageText>(join(companyDir(name), "sources", fileName));
}
