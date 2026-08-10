/**
 * 회사 오버레이의 도메인 타입.
 *
 * 오버레이는 산업 카드덱(packs/) 위에 회사 공시로 만든 한 겹을 얹는 것입니다.
 * 두 층은 신뢰 규칙이 다릅니다 — 카드는 `FACT` 가 될 수 없고, 오버레이는 될 수 있습니다.
 * 근거는 그 회사 공시뿐이며, 산업 카드는 근거가 아니라 **비교 기준**입니다.
 * 결정과 이유: docs/decisions/0011-company-overlay-on-pack-deck.md
 *
 * 저장은 영어, 화면 표기는 한국어입니다(ADR 0003).
 */

import type { AssertionStatus, Scope } from "./types.ts";
import type { Claim } from "./model.ts";

/**
 * 차이표 한 행의 상태.
 *
 * **작성자가 적는 값이 아니라 계산되는 값입니다.** 이것이 이 타입의 핵심입니다.
 * 근거를 붙이지 않고 `FACT` 라고 적을 방법이 없어야 도메인 규칙 2가 데이터 수준에서 지켜집니다.
 */
export const OVERLAY_ROW_STATUS = ["FACT", "UNVERIFIED", "CONFLICTING"] as const;
export type OverlayRowStatus = (typeof OVERLAY_ROW_STATUS)[number];

/**
 * 산업 쪽 비교 기준. **근거가 아닙니다**(ADR 0011 규칙 2).
 *
 * `cardId` 가 `null` 인 경우가 있습니다. 매트릭스에서 `필수` 인데 카드가 없는 개념이며,
 * 산업 덱이 구조적으로 담을 수 없어 오버레이가 받은 자리입니다
 * (packs/shipbuilding/MATRIX-REVIEW.md 발견 1). 그때는 `conceptId` 로 개념을 가리킵니다.
 * 둘 다 없으면 비교 기준이 어디서 왔는지 알 수 없으므로 로더가 막습니다.
 */
export interface IndustryReference {
  packId: string;
  cardId: string | null;
  /** field-matrix.json 의 개념 id. 카드가 없는 개념을 가리킬 때 씁니다. */
  conceptId?: string;
  /** 그 카드·개념이 말하는 업계 일반론. 화면에서 회사 사실과 다르게 보여야 합니다. */
  statement: string;
}

/** 차이표의 한 행. 작성자가 쓰는 형태입니다. */
export interface OverlayRowSpec {
  id: string;
  topic: string;
  industry: IndustryReference;
  /** 이 행을 지지하는 회사 Claim. 비어 있으면 UNVERIFIED 가 됩니다. */
  companyClaimIds: string[];
  /** 회사 사실이 산업 일반론과 어긋날 때, 무엇이 어떻게 다른지. 있으면 CONFLICTING 이 됩니다. */
  conflict?: string;
  /** UNVERIFIED 일 때 이 행이 올라갈 질문. 비면 로더가 막습니다(도메인 규칙 8). */
  questionId?: string;
}

/** 로더가 상태를 계산해 붙인 행. 화면과 검사는 이것만 봅니다. */
export interface OverlayRow extends OverlayRowSpec {
  status: OverlayRowStatus;
  claims: Claim[];
}

/** 회사에 물어볼 것 한 건. 반드시 어느 행에서 왔는지를 들고 있어야 역추적이 됩니다. */
export interface OverlayQuestion {
  id: string;
  question: string;
  /** 이 질문을 만든 차이표 행. 화면에서 원래 주장으로 되돌아가는 링크가 됩니다. */
  fromRow: string;
  expectedEvidence: string;
  ownerRole: string;
}

/** 회사 개요 — CO-01 이 쓰는 값. 숫자는 전부 Claim 으로 뒷받침됩니다. */
export interface OverlayProfile {
  positionId: string;
  positionLabel: string;
  headline: string;
  /** 사업 부문. 금액을 적으려면 claimId 가 있어야 합니다. */
  segments: { name: string; note: string; claimId?: string }[];
  /** 개요에서 바로 보여 줄 Claim. */
  claimIds: string[];
}

export interface OverlayMeta {
  id: string;
  companyName: string;
  corpCode: string;
  packId: string;
  industryLabel: string;
  fiscalYear: string;
  reportName: string;
  receiptNo: string;
  dartUrl: string;
  /** 이 오버레이가 하지 않는 것. 화면 아래에 항상 보입니다. */
  limits: string[];
}

export interface Overlay {
  meta: OverlayMeta;
  profile: OverlayProfile;
  rows: OverlayRow[];
  questions: OverlayQuestion[];
}

/**
 * 행의 상태를 계산합니다.
 *
 * 규칙은 세 줄입니다.
 * 1. 회사 Claim 이 없으면 `UNVERIFIED` — 빈칸을 조용히 채우지 않습니다(도메인 규칙 8).
 * 2. 있고 어긋남이 적혀 있으면 `CONFLICTING` — 사람이 해소하기 전까지 보이게 둡니다(규칙 9).
 * 3. 있고 어긋남이 없으면 `FACT` — 단, 참조한 Claim 이 전부 FACT 여야 합니다(규칙 2).
 *
 * 3의 조건을 어긴 경우는 여기서 판정하지 않고 로더가 오류로 막습니다.
 * 상태를 조용히 낮추면 작성자가 잘못 쓴 것이 화면에서 사라지기 때문입니다.
 */
export function deriveRowStatus(spec: OverlayRowSpec): OverlayRowStatus {
  if (spec.companyClaimIds.length === 0) return "UNVERIFIED";
  return spec.conflict ? "CONFLICTING" : "FACT";
}

/** 화면 표기. 색만으로 구분하지 않기 위해 글자와 기호를 함께 둡니다(CLAUDE.md UI 규칙). */
export const OVERLAY_STATUS_LABEL_KO: Record<
  OverlayRowStatus,
  { label: string; mark: string; hint: string }
> = {
  FACT: {
    label: "회사 확인",
    mark: "◆",
    hint: "이 회사 공시가 직접 지지합니다. 근거를 누르면 원문 섹션이 열립니다.",
  },
  CONFLICTING: {
    label: "산업과 다름",
    mark: "!",
    hint: "회사 공시가 업계 일반론과 다릅니다. 틀린 것이 아니라 다른 지점부터 다시 그려야 한다는 뜻입니다.",
  },
  UNVERIFIED: {
    label: "미확인",
    mark: "?",
    hint: "공시로 확인되지 않았습니다. 아래 '물어볼 것'으로 넘어갑니다.",
  },
};

/** 행 상태 → 기존 도메인 축. 오버레이가 seed/ 의 규칙 아래 있음을 코드로 잇습니다. */
export const OVERLAY_STATUS_CLAIM: Record<OverlayRowStatus, { scope: Scope; assertion: AssertionStatus }> = {
  FACT: { scope: "COMPANY", assertion: "FACT" },
  CONFLICTING: { scope: "COMPANY", assertion: "CONFLICTING" },
  UNVERIFIED: { scope: "COMPANY", assertion: "UNVERIFIED" },
};

export function rowsByStatus(rows: OverlayRow[], status: OverlayRowStatus): OverlayRow[] {
  return rows.filter((r) => r.status === status);
}
