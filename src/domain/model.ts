/** 시드 데이터의 형태. 데이터베이스를 도입할 때 이 타입이 스키마의 출발점이 됩니다. */

import type { AssertionStatus, EvidenceRelation, ReviewStatus, Scope, TrustGrade } from "./types.ts";

export interface Snapshot {
  file: string;
  sha256: string | null;
  bytes: number | null;
  pages: number | null;
  fetched_at: string;
  effective_date: string | null;
  parser: string;
  pages_text_file?: string;
  page_numbering: string;
}

export interface Source {
  id: string;
  title: string;
  publisher: string;
  source_type: string;
  url: string;
  trust_grade: TrustGrade;
  authority: string;
  directness: string;
  freshness: string;
  company_specificity: string;
  can_support_scope: Scope[];
  cannot_support_scope: Scope[];
  snapshot: Snapshot;
  limitations?: string;
  notes?: string;
}

export interface EvidenceSpan {
  id: string;
  source_id: string;
  page: number;
  section: string;
  quote: string;
}

export interface ClaimEvidence {
  span_id: string;
  relation: EvidenceRelation;
}

export interface Claim {
  id: string;
  text: string;
  scope: Scope;
  assertion_status: AssertionStatus;
  review_status: ReviewStatus;
  evidence: ClaimEvidence[];
  premises: string[];
  steps?: string[];
  inference_note?: string;
  audit_note?: string;
  converts_to?: { request_items?: string[]; interview_questions?: string[] };
  blocks_resolution_of?: string[];
}

export interface Actor {
  id: string;
  name: string;
  actor_type: string;
  note?: string;
}

export interface Flow {
  from: string;
  to: string;
  flow_type: "SERVICE" | "CASH" | "DOCUMENT";
  label: string;
}

export interface TransactionStep {
  id: string;
  sequence: number;
  name: string;
  trigger: string;
  completion_condition: string;
  flows: Flow[];
  claims: string[];
}

export interface AuditRisk {
  id: string;
  step_id: string;
  title: string;
  assertions: string[];
  risk_text: string;
  rationale_claims: string[];
  counter_claims?: string[];
  open_questions?: string[];
  accounts: string[];
  note?: string;
}

export interface RequestItem {
  id: string;
  item: string;
  purpose: string;
  period: string;
  owner_role: string;
  priority: string;
  risk_ids: string[];
  claim_ids: string[];
}

export interface InterviewQuestion {
  id: string;
  question: string;
  expected_evidence: string;
  follow_up_rule: string;
  owner_role: string;
  risk_ids: string[];
  claim_ids: string[];
}

export interface CaseInfo {
  id: string;
  company_name: string;
  is_fictional: boolean;
  industry: string;
  period_start: string;
  period_end: string;
  status: string;
  fiction_policy: { decision: string; consequence: string; adr: string };
  notes: string;
}

export interface Seed {
  case: CaseInfo;
  sources: Source[];
  evidenceSpans: EvidenceSpan[];
  claims: Claim[];
  steps: TransactionStep[];
  actors: Actor[];
  risks: AuditRisk[];
  requestItems: RequestItem[];
  interviewQuestions: InterviewQuestion[];
}

export interface PageText {
  /** PDF 추출본에만 있습니다. */
  source_id?: string;
  pdf_file?: string;
  pdf_sha256?: string;
  page_count?: number;
  /** DART 섹션 추출본에만 있습니다. */
  source_file?: string;
  sha256?: string;
  section_count?: number;
  titles?: Record<string, string>;

  parser: string;
  pages: Record<string, string>;
}
