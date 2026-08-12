/**
 * 실제 회사 사례 화면 (공시 근거).
 *
 * 이 화면은 회계처리 적정성이나 감사의견을 말하지 않습니다.
 * 공시로 확인된 사실, 공시로 확인되지 않은 것, 그래서 무엇을 더 물어야 하는지만 보여줍니다.
 */

import {
  THEME_BASE,
  THEME_CURSOR_CSS,
  THEME_CURSOR_JS,
  THEME_FONTS,
  THEME_ROOT,
  THEME_TOPBAR_CSS,
} from "./theme.ts";
import { ASSERTION_LABEL_KO, SCOPE_LABEL_KO } from "../domain/types.ts";
import type { CompanySeed } from "../seed/loadCompany.ts";
import { byId } from "../seed/load.ts";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const OUTCOME: Record<string, { label: string; mark: string; cls: string }> = {
  RESOLVED: { label: "확인됨", mark: "◆", cls: "o-resolved" },
  PARTIAL: { label: "일부만 확인", mark: "◐", cls: "o-partial" },
  UNRESOLVED: { label: "확인 안 됨", mark: "?", cls: "o-unresolved" },
};

export function renderCompanyPage(company: CompanySeed, options: { candidatesLink?: string } = {}): string {
  const spans = byId(company.evidenceSpans);
  const sources = byId(company.sources);
  const c = company.case;

  const claimCards = company.claims
    .map((claim) => {
      const meta = ASSERTION_LABEL_KO[claim.assertion_status];
      const evidence = claim.evidence
        .map((e) => {
          const span = spans.get(e.span_id);
          if (!span) return "";
          const src = sources.get(span.source_id);
          if (!src) return "";
          return `
          <div class="evidence">
            <div class="ev-where">${esc(src.title)} · 섹션 ${span.page} · ${esc(span.section)}</div>
            <blockquote class="ev-quote">${esc(span.quote)}</blockquote>
            <button class="open-src" data-file="${esc(src.snapshot.pages_text_file ?? "")}" data-section="${span.page}">
              이 섹션 원문 보기
            </button>
            <a class="ev-link" href="${esc(src.url)}" target="_blank" rel="noopener">DART에서 원문 보기 ↗</a>
          </div>`;
        })
        .join("");

      return `
      <article class="claim" data-claim="${esc(claim.id)}" data-status="${claim.assertion_status}" data-scope="${claim.scope}">
        <header class="claim-head">
          <span class="badge b-${claim.assertion_status.toLowerCase()}"><span class="mark">${meta.mark}</span>${meta.label}</span>
          <span class="scope sc-company">${SCOPE_LABEL_KO[claim.scope]}</span>
          <span class="claim-id">${esc(claim.id)}</span>
        </header>
        <p class="claim-text">${esc(claim.text)}</p>
        ${claim.audit_note ? `<p class="claim-note">감사 관점: ${esc(claim.audit_note)}</p>` : ""}
        ${evidence}
      </article>`;
    })
    .join("");

  const statusRows = c.open_questions_status
    .map((row) => {
      const o = OUTCOME[row.outcome]!;
      return `
      <tr>
        <td class="mono">${esc(row.claim_id)}</td>
        <td>${esc(row.question)}</td>
        <td><span class="outcome ${o.cls}"><span class="mark">${o.mark}</span>${o.label}</span></td>
        <td>${esc(row.resolved)}</td>
        <td class="unknown">${esc(row.still_unknown)}</td>
        <td>${row.next_action.map((a) => `<span class="pill">${esc(a)}</span>`).join(" ")}</td>
      </tr>`;
    })
    .join("");

  const src = company.sources[0]!;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.company_name)} — 공시 근거</title>
${THEME_FONTS}
<style>
${THEME_ROOT}
${THEME_BASE}
${THEME_TOPBAR_CSS}
${THEME_CURSOR_CSS}
header.top{background:var(--panel);border-bottom:1px solid var(--line);padding:14px 20px}
.nav{display:flex;gap:14px;margin-bottom:8px}
.nav a{color:var(--accent)}
h1{font-size:18px;margin:0 0 4px}
h2{font-size:15px;margin:24px 0 10px}
.meta{color:var(--muted);margin:0}
.meta a{color:var(--accent)}
.warn{margin-top:10px;padding:9px 12px;border:1px solid var(--warn);background:#fbecec;border-radius:2px}
main{padding:4px 20px 60px;max-width:1200px}
.claim{background:var(--panel);border:1px solid var(--line);border-radius:2px;padding:11px 13px;margin-bottom:9px}
.claim-head{display:flex;align-items:center;gap:7px;margin-bottom:6px}
.claim-id{margin-left:auto;color:var(--muted);font-size:12px}
.claim-text{margin:0 0 7px;font-weight:600}
.claim-note{margin:0 0 7px;color:var(--muted);font-size:13px;border-left:3px solid var(--line);padding-left:8px}
.badge{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:1px 8px;font-size:12.5px;font-weight:700;border:1px solid}
.b-fact{color:var(--fact);border-color:var(--fact);background:#eaf4ee}
.scope{font-size:11.5px;border-radius:4px;padding:1px 7px;border:1px dashed;color:var(--company);border-color:var(--company)}
.evidence{border-top:1px dashed var(--line);padding-top:8px;margin-top:6px}
.ev-where{color:var(--muted);font-size:12.5px;margin-bottom:5px}
.ev-quote{margin:0 0 6px;padding:7px 10px;background:#f2f5f8;border-left:3px solid #9bb6d0;border-radius:0 5px 5px 0;font-size:13px;white-space:pre-wrap;word-break:break-word}
.open-src{font:inherit;font-size:12.5px;cursor:pointer;background:var(--accent);color:#fff;border:0;border-radius:5px;padding:4px 10px;margin-right:8px}
.ev-link{font-size:12.5px}
table{border-collapse:collapse;width:100%;background:var(--panel);border:1px solid var(--line);border-radius:2px;overflow:hidden}
th,td{border-bottom:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top;font-size:13px}
th{background:#f0f3f7;font-size:12.5px;color:var(--muted)}
.mono{font-variant-numeric:tabular-nums;white-space:nowrap}
.unknown{color:var(--warn)}
.outcome{display:inline-flex;align-items:center;gap:4px;font-weight:700;font-size:12.5px;white-space:nowrap}
.o-resolved{color:var(--fact)}.o-partial{color:#8a5a00}.o-unresolved{color:var(--company)}
.pill{display:inline-block;font-size:11.5px;border:1px solid var(--line);border-radius:2px;padding:1px 8px;background:#fff}
ul.neg{background:var(--panel);border:1px solid var(--line);border-radius:2px;padding:10px 12px 10px 30px;margin:0}
ul.neg li{margin-bottom:4px}
.note{color:var(--muted);font-size:13px}
.pending{background:#fdf6e3;border:1px solid #d9b25a;border-radius:2px;padding:12px 14px}
.pending p{margin:6px 0}
.pending-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.pending-tag{font-size:11.5px;font-weight:700;border:1px solid #8a5a00;color:#8a5a00;border-radius:4px;padding:1px 7px;background:#fff}
dialog{border:1px solid var(--line);border-radius:2px;padding:0;max-width:900px;width:94vw}
dialog::backdrop{background:rgba(20,28,38,.45)}
.dlg-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line)}
.dlg-body{padding:12px 16px;max-height:70vh;overflow:auto}
.dlg-body pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:13px;margin:0}
.dlg-close{font:inherit;cursor:pointer;border:1px solid var(--line);background:#fff;border-radius:5px;padding:3px 10px}
code{font-family:Consolas,monospace;font-size:11.5px;word-break:break-all}
</style>
</head>
<body>
<header class="top">
  <div class="nav">
    <a href="index.html">← 첫 화면</a>
    <a href="travel-bsp.html">가상 여행사 거래 지도 →</a>
    ${options.candidatesLink ? `<a href="${esc(options.candidatesLink)}">근거 후보 검토 →</a>` : ""}
  </div>
  <h1>${esc(c.company_name)} — 공시로 확인된 것과 확인되지 않은 것</h1>
  <p class="meta">
    ${esc(c.industry)} · 보고기간 ${esc(c.period_start)} ~ ${esc(c.period_end)} ·
    고유번호 ${esc(c.corp_code)} · 종목코드 ${esc(c.stock_code)}<br>
    출처: ${esc(src.title)} (등급 ${esc(src.trust_grade)}, 수집 ${esc(src.snapshot.fetched_at)}) ·
    <a href="${esc(src.url)}" target="_blank" rel="noopener">DART 원문 ↗</a><br>
    스냅샷 sha256 <code>${esc(src.snapshot.sha256 ?? "")}</code>
  </p>
  <p class="warn">
    <strong>이 화면은 회계처리의 적정성이나 감사의견을 말하지 않습니다.</strong>
    ${esc(c.real_company_policy.consequence)}
  </p>
</header>

<main>
  <h2>공시로 직접 확인된 사실 ${company.claims.length}건</h2>
  ${claimCards}

  ${
    c.pending_review_highlight
      ? `<h2>승인 대기 중인 후보</h2>
  <div class="pending">
    <div class="pending-head"><span class="pending-tag">검토 대기</span><strong>${esc(c.pending_review_highlight.title)}</strong></div>
    <div class="ev-where">섹션 ${c.pending_review_highlight.section} · ${esc(c.pending_review_highlight.section_title)}</div>
    <blockquote class="ev-quote">${esc(c.pending_review_highlight.quote)}</blockquote>
    <p class="note">${esc(c.pending_review_highlight.context)}</p>
    <p><strong>왜 중요한가</strong> ${esc(c.pending_review_highlight.why_it_matters)}</p>
    <p class="unknown"><strong>한계</strong> ${esc(c.pending_review_highlight.limits)}</p>
    <button class="open-src" data-file="${esc(src.snapshot.pages_text_file ?? "")}" data-section="${c.pending_review_highlight.section}">
      이 섹션 원문 보기
    </button>
  </div>`
      : ""
  }

  <h2>가상 사례에서 미확인이던 항목은 어떻게 됐나</h2>
  <table>
    <thead>
      <tr><th>Claim</th><th>확인하려던 것</th><th>결과</th><th>확인된 부분</th><th>여전히 모르는 것</th><th>다음 행동</th></tr>
    </thead>
    <tbody>${statusRows}</tbody>
  </table>

  <h2>공시에서 찾지 못한 것</h2>
  <ul class="neg">
    ${c.search_negative_findings.map((n) => `<li>${esc(n)}</li>`).join("")}
  </ul>
  <p class="note">
    ${esc(src.limitations ?? "")}
  </p>
</main>

<dialog id="src-dialog">
  <div class="dlg-head"><strong id="dlg-title">원문</strong><button class="dlg-close" id="dlg-close">닫기</button></div>
  <div class="dlg-body"><pre id="dlg-text">불러오는 중…</pre></div>
</dialog>

<script>
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
${THEME_CURSOR_JS}
</body>
</html>
`;
}
