/**
 * 근거 후보 찾기.
 *
 * 원문에서 관심 있는 낱말이 나오는 위치를 찾아, 사람이 검토할 후보 목록을 만듭니다.
 *
 * 중요: 이것은 **검색 보조 도구**이지 Claim 생성기가 아닙니다.
 * 여기서 나온 후보는 어떤 상태도 갖지 않습니다. 사람이 원문을 보고 인용문을 확정해
 * Evidence Span으로 등록해야 비로소 근거가 됩니다. 인용문의 정확성은 그때
 * tests/seed-integrity.test.ts 의 T9(원문 대조)가 검사합니다.
 *
 * AI를 쓰지 않습니다. 같은 입력에 항상 같은 결과가 나옵니다.
 */

export interface Candidate {
  /** 문서 내 페이지 번호 */
  page: number;
  /** 찾은 낱말 */
  term: string;
  /** 그 낱말 주변의 원문 조각 (사람이 읽고 판단할 용도) */
  snippet: string;
  /** 정규화한 페이지 텍스트 안에서의 위치. 같은 페이지 내 여러 건을 구분합니다. */
  offset: number;
}

export interface FindOptions {
  /** 앞뒤로 함께 보여줄 글자 수 */
  window?: number;
  /** 한 페이지에서 같은 낱말을 최대 몇 건까지 가져올지 */
  maxPerPageTerm?: number;
}

/** 줄바꿈과 연속 공백만 하나의 공백으로 정리합니다. 낱말은 바꾸지 않습니다. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/**
 * 페이지별 원문에서 낱말이 나오는 곳을 찾습니다.
 * 결과는 페이지 번호 → 낱말 순서 → 등장 위치 순으로 항상 같게 정렬됩니다.
 */
export function findCandidates(
  pages: Record<string, string>,
  terms: string[],
  options: FindOptions = {},
): Candidate[] {
  const window = options.window ?? 160;
  const maxPerPageTerm = options.maxPerPageTerm ?? 3;

  const pageNumbers = Object.keys(pages)
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  const out: Candidate[] = [];

  for (const page of pageNumbers) {
    const text = collapseWhitespace(pages[String(page)] ?? "");
    if (!text) continue;
    const haystack = text.toLowerCase();

    for (const term of terms) {
      const needle = collapseWhitespace(term).toLowerCase();
      if (!needle) continue;

      let from = 0;
      let found = 0;
      while (found < maxPerPageTerm) {
        const at = haystack.indexOf(needle, from);
        if (at === -1) break;

        const start = Math.max(0, at - window);
        const end = Math.min(text.length, at + needle.length + window);
        out.push({
          page,
          term,
          offset: at,
          snippet: (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : ""),
        });

        from = at + needle.length;
        found++;
      }
    }
  }

  return out;
}

/** 사용제한예금·담보 관련 근거를 찾을 때 쓰는 기본 검색어(한국어 공시용). */
export const RESTRICTED_DEPOSIT_TERMS = [
  "사용이 제한",
  "사용제한",
  "질권",
  "담보로 제공",
  "담보제공",
  "지급보증",
  "예치",
];

/** BSP·항공권 정산 관련 근거를 찾을 때 쓰는 기본 검색어. */
export const BSP_TERMS = ["BSP", "항공권", "정산", "여행사업", "대리인"];

/**
 * 조선·조선기자재 회사의 공시에서 근거를 찾을 때 쓰는 검색어.
 *
 * 고른 기준은 `packs/shipbuilding/field-matrix.json` 에서 `필수` 로 판정됐는데
 * 산업 자료로는 열리지 않는 개념(K-03·K-04·K-05·K-06·K-16·K-18)입니다.
 * 즉 **산업팩의 빈칸을 겨냥한 검색어**이며, 회사 공시에서만 채워지는 것들입니다.
 */
export const SHIPBUILDING_TERMS = [
  /* K-03 수익인식·진행률 */
  "진행기준",
  "투입법",
  "진행률",
  "수행의무",
  "한 시점에",
  "기간에 걸쳐",
  /* K-04 총계약원가 */
  "총계약원가",
  "총계약예정원가",
  "공사손실충당부채",
  /* K-05 계약변경 */
  "계약변경",
  "공사변경",
  "변동대가",
  /* K-06 지연·취소 */
  "지체상금",
  "계약해지",
  /* 계약 잔액 */
  "계약자산",
  "계약부채",
  "미청구공사",
  "초과청구공사",
  "잔여수행의무",
  /* K-07 RG·보증 */
  "선수금환급보증",
  "이행보증",
  /* K-12 하자보증 */
  "하자보수",
  "판매보증충당부채",
  /* K-16 환헤지 */
  "위험회피",
  "통화선도",
  /* K-11·K-18 특수관계·연결범위 */
  "특수관계자",
  "종속기업",
  /* 감사 논점의 출발점 */
  "핵심감사사항",
];
