/**
 * 근거 후보 검토 화면.
 *
 * 후보는 Claim이 아닙니다. 아무 상태도 갖지 않으며, 여기서 사람이 원문을 확인한 뒤
 * 확정한 것만 Evidence Span과 Claim이 됩니다(ADR 0007).
 * 그래서 이 화면에는 사실/추정 배지를 절대 표시하지 않습니다.
 */

export interface CandidateRow {
  file: string;
  section: number;
  section_title: string;
  term: string;
  snippet: string;
  review_status: string;
}

export interface DartManifest {
  corp_code: string;
  corp_name: string;
  report_name: string;
  receipt_no: string;
  receipt_date: string;
  url: string;
  fetched_at: string;
  trust_grade: string;
  files: Array<{ file: string; sha256: string; bytes: number; sections: number; sections_file: string }>;
  note: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 후보 조각 안에서 찾은 낱말을 표시합니다. */
function highlight(snippet: string, term: string): string {
  const safe = esc(snippet);
  const t = esc(term);
  if (!t) return safe;
  const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return safe.replace(re, (m) => `<mark>${m}</mark>`);
}

export function renderCandidatesPage(manifest: DartManifest, candidates: CandidateRow[]): string {
  const terms = [...new Set(candidates.map((c) => c.term))].sort();
  const byFile = new Map<string, CandidateRow[]>();
  for (const c of candidates) {
    if (!byFile.has(c.file)) byFile.set(c.file, []);
    byFile.get(c.file)!.push(c);
  }

  const fileMeta = new Map(manifest.files.map((f) => [f.file, f]));

  const groups = [...byFile.entries()]
    .map(([file, rows]) => {
      const meta = fileMeta.get(file);
      const bySection = new Map<number, CandidateRow[]>();
      for (const r of rows) {
        if (!bySection.has(r.section)) bySection.set(r.section, []);
        bySection.get(r.section)!.push(r);
      }

      const sections = [...bySection.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([section, items]) => {
          const title = items[0]!.section_title || "(제목 없음)";
          return `
        <section class="sec" data-terms="${esc([...new Set(items.map((i) => i.term))].join(" "))}">
          <header class="sec-head">
            <span class="sec-no">섹션 ${section}</span>
            <h3>${esc(title)}</h3>
            <button class="open-src" data-file="${esc(meta?.sections_file ?? "")}" data-section="${section}">
              이 섹션 원문 보기
            </button>
          </header>
          ${items
            .map(
              (i) => `<div class="cand" data-term="${esc(i.term)}">
              <div class="cand-head">
                <span class="term">${esc(i.term)}</span>
                <span class="pending">검토 대기</span>
              </div>
              <p class="snippet">${highlight(i.snippet, i.term)}</p>
            </div>`,
            )
            .join("")}
        </section>`;
        })
        .join("");

      return `
      <div class="file-group">
        <h2>${esc(file)}</h2>
        <p class="file-meta">
          ${meta ? `${meta.bytes.toLocaleString()} bytes · 섹션 ${meta.sections}개 · sha256 <code>${esc(meta.sha256)}</code>` : ""}
        </p>
        ${sections}
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>근거 후보 검토 — ${esc(manifest.corp_name)} ${esc(manifest.report_name)}</title>
<style>
:root{--bg:#f6f7f9;--panel:#fff;--line:#d9dee5;--ink:#1b2430;--muted:#5d6b7a;--accent:#31506e}
*{box-sizing:border-box}
body{margin:0;font-family:"Malgun Gothic","맑은 고딕",system-ui,sans-serif;background:var(--bg);color:var(--ink);font-size:14px;line-height:1.6}
header.top{background:var(--panel);border-bottom:1px solid var(--line);padding:14px 20px}
h1{font-size:18px;margin:0 0 6px}
.meta{color:var(--muted)}
.meta a{color:var(--accent)}
.warn{margin-top:10px;padding:9px 12px;border:1px solid #d9b25a;background:#fdf6e3;border-radius:6px}
.back{display:inline-block;margin-bottom:8px;color:var(--accent)}
.filters{padding:12px 20px;background:var(--panel);border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.filters span.label{color:var(--muted);margin-right:4px}
.chip{font:inherit;font-size:12.5px;border:1px solid var(--line);background:#fff;border-radius:14px;padding:3px 11px;cursor:pointer}
.chip.active{background:var(--accent);color:#fff;border-color:var(--accent)}
main{padding:16px 20px 60px}
.file-group{margin-bottom:26px}
.file-group h2{font-size:15px;margin:0 0 2px}
.file-meta{margin:0 0 12px;color:var(--muted);font-size:12.5px}
code{font-family:Consolas,monospace;font-size:11.5px;word-break:break-all}
.sec{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 13px;margin-bottom:9px}
.sec.hidden{display:none}
.sec-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:7px}
.sec-no{font-size:11.5px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:1px 7px}
.sec-head h3{font-size:14px;margin:0;flex:1 1 240px}
.open-src{font:inherit;font-size:12.5px;cursor:pointer;background:var(--accent);color:#fff;border:0;border-radius:5px;padding:4px 10px}
.cand{border-top:1px dashed var(--line);padding-top:7px;margin-top:7px}
.cand.hidden{display:none}
.cand-head{display:flex;gap:8px;align-items:center;margin-bottom:3px}
.term{font-size:11.5px;border:1px solid var(--accent);color:var(--accent);border-radius:4px;padding:1px 7px}
.pending{font-size:11.5px;color:var(--muted)}
.snippet{margin:0;background:#f2f5f8;border-left:3px solid #9bb6d0;border-radius:0 5px 5px 0;padding:7px 10px;font-size:13px;white-space:pre-wrap;word-break:break-word}
mark{background:#ffe9a8;padding:0 2px}
dialog{border:1px solid var(--line);border-radius:10px;padding:0;max-width:900px;width:94vw}
dialog::backdrop{background:rgba(20,28,38,.45)}
.dlg-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line)}
.dlg-body{padding:12px 16px;max-height:70vh;overflow:auto}
.dlg-body pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:13px;margin:0}
.dlg-close{font:inherit;cursor:pointer;border:1px solid var(--line);background:#fff;border-radius:5px;padding:3px 10px}
</style>
</head>
<body>
<header class="top">
  <a class="back" href="index.html">← 거래 지도로 돌아가기</a>
  <h1>근거 후보 검토 — ${esc(manifest.corp_name)} ${esc(manifest.report_name)}</h1>
  <p class="meta">
    접수번호 ${esc(manifest.receipt_no)} · 접수일 ${esc(manifest.receipt_date)} · 수집일 ${esc(manifest.fetched_at)} ·
    출처 등급 ${esc(manifest.trust_grade)} ·
    <a href="${esc(manifest.url)}" target="_blank" rel="noopener">DART에서 원문 보기 ↗</a>
  </p>
  <p class="warn">
    <strong>이 목록은 근거가 아닙니다.</strong> 검색어가 나온 자리를 모아둔 <strong>후보</strong>일 뿐이며,
    사실·추정 어느 쪽도 아닙니다. 사람이 원문을 확인해 확정한 것만 근거가 됩니다.
    후보 ${candidates.length}건 전부 검토 대기 상태입니다.
  </p>
</header>

<div class="filters">
  <span class="label">검색어로 거르기</span>
  <button class="chip active" data-filter="*">전체 ${candidates.length}</button>
  ${terms
    .map(
      (t) =>
        `<button class="chip" data-filter="${esc(t)}">${esc(t)} ${candidates.filter((c) => c.term === t).length}</button>`,
    )
    .join("")}
</div>

<main>${groups}</main>

<dialog id="src-dialog">
  <div class="dlg-head"><strong id="dlg-title">원문</strong><button class="dlg-close" id="dlg-close">닫기</button></div>
  <div class="dlg-body"><pre id="dlg-text">불러오는 중…</pre></div>
</dialog>

<script>
document.querySelectorAll(".filters .chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    const f = btn.dataset.filter;
    document.querySelectorAll(".filters .chip").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".cand").forEach((c) => {
      c.classList.toggle("hidden", f !== "*" && c.dataset.term !== f);
    });
    document.querySelectorAll(".sec").forEach((s) => {
      const visible = [...s.querySelectorAll(".cand")].some((c) => !c.classList.contains("hidden"));
      s.classList.toggle("hidden", !visible);
    });
  });
});

const dlg = document.getElementById("src-dialog");
document.getElementById("dlg-close").addEventListener("click", () => dlg.close());
const cache = new Map();

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".open-src");
  if (!btn) return;
  const file = btn.dataset.file;
  const section = btn.dataset.section;
  document.getElementById("dlg-title").textContent = "원문 · 섹션 " + section;
  document.getElementById("dlg-text").textContent = "불러오는 중…";
  dlg.showModal();
  try {
    if (!cache.has(file)) {
      const res = await fetch("sources/" + encodeURIComponent(file));
      if (!res.ok) throw new Error("HTTP " + res.status);
      cache.set(file, await res.json());
    }
    const data = cache.get(file);
    document.getElementById("dlg-title").textContent =
      "원문 · 섹션 " + section + " · " + (data.titles?.[section] ?? "");
    document.getElementById("dlg-text").textContent = data.pages?.[section] ?? "(내용 없음)";
  } catch (err) {
    document.getElementById("dlg-text").textContent = "원문을 불러오지 못했습니다: " + err.message;
  }
});
</script>
</body>
</html>
`;
}
