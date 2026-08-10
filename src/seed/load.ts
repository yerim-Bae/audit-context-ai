/**
 * 시드 로더. 데이터베이스 없이 JSON 파일에서 바로 읽습니다.
 * 데이터베이스 도입 시점과 이유: docs/decisions/0001-defer-database.md
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import type {
  Actor,
  AuditRisk,
  CaseInfo,
  Claim,
  EvidenceSpan,
  InterviewQuestion,
  PageText,
  RequestItem,
  Seed,
  Source,
  TransactionStep,
} from "../domain/model.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..");
export const SEED_DIR = join(REPO_ROOT, "seed", "travel-bsp");
export const SOURCES_DIR = join(SEED_DIR, "sources");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function loadSeed(): Seed {
  const manifest = readJson<{ sources: Source[]; evidence_spans: EvidenceSpan[] }>(
    join(SOURCES_DIR, "manifest.json"),
  );
  const stepsFile = readJson<{ actors: Actor[]; steps: TransactionStep[] }>(
    join(SEED_DIR, "transaction-steps.json"),
  );

  return {
    case: readJson<CaseInfo>(join(SEED_DIR, "case.json")),
    sources: manifest.sources,
    evidenceSpans: manifest.evidence_spans,
    claims: readJson<{ claims: Claim[] }>(join(SEED_DIR, "claims.json")).claims,
    steps: stepsFile.steps,
    actors: stepsFile.actors,
    risks: readJson<{ risks: AuditRisk[] }>(join(SEED_DIR, "risks.json")).risks,
    requestItems: readJson<{ request_items: RequestItem[] }>(join(SEED_DIR, "request-items.json"))
      .request_items,
    interviewQuestions: readJson<{ interview_questions: InterviewQuestion[] }>(
      join(SEED_DIR, "interview-questions.json"),
    ).interview_questions,
  };
}

/** 인용 검증용 페이지별 원문. scripts/extract_pdf_pages.py 가 생성합니다. */
export function loadPageText(fileName: string): PageText {
  return readJson<PageText>(join(SOURCES_DIR, fileName));
}

export function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}
