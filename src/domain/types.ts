/**
 * 도메인 열거값과 화면 표기.
 *
 * 저장은 영어, 화면 표기는 한국어입니다(docs/decisions/0003-english-storage-korean-ui.md).
 * 신뢰도 숫자는 도메인에 두지 않습니다(docs/decisions/0002-no-confidence-score.md).
 */

export const ASSERTION_STATUS = ["FACT", "INFERENCE", "UNVERIFIED", "CONFLICTING"] as const;
export type AssertionStatus = (typeof ASSERTION_STATUS)[number];

export const REVIEW_STATUS = ["AI_EXTRACTED", "HUMAN_VERIFIED", "REJECTED", "STALE"] as const;
export type ReviewStatus = (typeof REVIEW_STATUS)[number];

export const SCOPE = ["INDUSTRY", "COMPANY", "PERIOD", "TRANSACTION"] as const;
export type Scope = (typeof SCOPE)[number];

export const TRUST_GRADE = ["S", "A", "B", "C", "D"] as const;
export type TrustGrade = (typeof TRUST_GRADE)[number];

export const EVIDENCE_RELATION = ["SUPPORTS", "REFUTES", "CONTEXT"] as const;
export type EvidenceRelation = (typeof EVIDENCE_RELATION)[number];

/** 화면 표기. 색만으로 상태를 구분하지 않기 위해 글자와 기호를 함께 둡니다. */
export const ASSERTION_LABEL_KO: Record<AssertionStatus, { label: string; mark: string; hint: string }> = {
  FACT: {
    label: "사실",
    mark: "◆",
    hint: "근거 원문이 이 주장을 직접 지지하며 적용 범위가 일치합니다.",
  },
  INFERENCE: {
    label: "추정",
    mark: "◇",
    hint: "확인된 사실에서 도출했으나 직접 확인되지 않았습니다.",
  },
  UNVERIFIED: {
    label: "미확인",
    mark: "?",
    hint: "필요한 근거가 없어 결론을 낼 수 없습니다. 요청자료나 인터뷰 질문으로 전환합니다.",
  },
  CONFLICTING: {
    label: "상충",
    mark: "!",
    hint: "둘 이상의 근거가 서로 양립하지 않습니다. 사람이 해소하기 전까지 결론을 내지 않습니다.",
  },
};

export const SCOPE_LABEL_KO: Record<Scope, string> = {
  INDUSTRY: "산업 일반",
  COMPANY: "회사 특정",
  PERIOD: "기간 특정",
  TRANSACTION: "거래 특정",
};
