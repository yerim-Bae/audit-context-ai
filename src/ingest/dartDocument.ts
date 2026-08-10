/**
 * DART 공시 원문(XML)을 사람이 읽는 텍스트와 재현 가능한 위치로 바꿉니다.
 *
 * PDF에서 "페이지"가 위치의 단위였다면, DART 원문에서는 **섹션 제목**이 그 역할을 합니다.
 * 같은 원문을 다시 처리하면 같은 섹션 번호와 제목이 나옵니다.
 *
 * 이 파일은 텍스트를 만들기만 합니다. 어떤 Claim도, 어떤 상태도 만들지 않습니다.
 */

export interface DocumentSection {
  /** 1부터 시작하는 섹션 번호. 위치를 가리킬 때 씁니다. */
  index: number;
  /** 이 섹션 바로 앞의 TITLE. 없으면 "(제목 없음)". */
  title: string;
  /** 태그를 걷어낸 본문 */
  text: string;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
  "&cr;": "\n",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

/** 표의 칸이 붙어버리지 않도록 구분자를 넣고, 나머지 태그는 제거합니다. */
function stripTags(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<\/(TD|TH|TE|TU)>/gi, " | ")
      .replace(/<\/(TR|P|TITLE|SPAN)>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * TITLE 태그를 경계로 원문을 섹션으로 나눕니다.
 * @param minChars 이보다 짧은 섹션은 앞 섹션에 붙입니다(제목만 있고 내용이 없는 경우).
 */
export function splitSections(xml: string, minChars = 40): DocumentSection[] {
  const titleRe = /<TITLE\b[^>]*>([\s\S]*?)<\/TITLE>/gi;
  const marks: Array<{ at: number; end: number; title: string }> = [];
  for (const m of xml.matchAll(titleRe)) {
    marks.push({
      at: m.index!,
      end: m.index! + m[0].length,
      title: stripTags(m[1]!).replace(/\s+/g, " ").trim() || "(제목 없음)",
    });
  }

  const raw: Array<{ title: string; text: string }> = [];

  if (marks.length === 0) {
    raw.push({ title: "(제목 없음)", text: stripTags(xml) });
  } else {
    const head = stripTags(xml.slice(0, marks[0]!.at));
    if (head.length >= minChars) raw.push({ title: "(문서 머리말)", text: head });

    for (let i = 0; i < marks.length; i++) {
      const from = marks[i]!.end;
      const to = i + 1 < marks.length ? marks[i + 1]!.at : xml.length;
      raw.push({ title: marks[i]!.title, text: stripTags(xml.slice(from, to)) });
    }
  }

  // 내용이 거의 없는 섹션은 앞 섹션에 합칩니다.
  const merged: Array<{ title: string; text: string }> = [];
  for (const s of raw) {
    if (s.text.length < minChars && merged.length > 0) {
      const prev = merged[merged.length - 1]!;
      prev.text = (prev.text + "\n" + s.title + "\n" + s.text).trim();
      continue;
    }
    merged.push({ ...s });
  }

  return merged.map((s, i) => ({ index: i + 1, title: s.title, text: s.text }));
}

/** 섹션 배열을 findCandidates 가 쓰는 형태(번호 → 본문)로 바꿉니다. */
export function sectionsAsPages(sections: DocumentSection[]): Record<string, string> {
  return Object.fromEntries(sections.map((s) => [String(s.index), s.text]));
}
