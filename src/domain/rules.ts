/**
 * 신뢰성 규칙. 화면과 테스트가 같은 함수를 씁니다.
 * 규칙 문서: docs/source-policy.md, docs/claim-lifecycle.md
 */

/**
 * 인용문 대조용 정규화.
 * PDF 텍스트 추출은 낱말 중간에 공백을 넣거나 줄바꿈을 남기므로,
 * 공백을 모두 제거하고 문자 모양 차이만 통일한 뒤 비교합니다.
 * 단어와 숫자 자체는 바꾸지 않습니다.
 */
export function normalizeForQuoteMatch(text: string): string {
  return text
    .replace(/[‘’‛ʼ]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/[•●▪·]/g, "")
    .replace(/[\s​‌‍﻿]+/gu, "");
}

/**
 * 출처가 FACT의 근거가 될 수 있는지.
 * 링크만 저장된 출처, 원문 바이트 스냅샷과 해시가 없는 출처는 FACT를 뒷받침할 수 없습니다.
 */
export function canSupportFact(source: {
  trust_grade: string;
  snapshot?: { sha256?: string | null; bytes?: number | null } | null;
}): boolean {
  if (source.trust_grade === "D") return false;
  const snap = source.snapshot;
  if (!snap) return false;
  if (!snap.sha256 || !snap.bytes) return false;
  return true;
}

/**
 * 근거 출처의 적용 범위가 주장의 범위를 덮는지.
 * 산업 일반 자료는 회사 특정 주장을 사실로 만들 수 없습니다.
 */
export function sourceCoversScope(source: { can_support_scope?: string[] }, claimScope: string): boolean {
  return Array.isArray(source.can_support_scope) && source.can_support_scope.includes(claimScope);
}
