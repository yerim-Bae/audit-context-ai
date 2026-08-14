/**
 * 회사 오버레이 화면. 회사 하나를 단일 HTML 문자열로 만듭니다.
 *
 * 카드 세 장만 있습니다 — CO-01 무엇을 파는가 / CO-02 산업 표준과 다른 점 / CO-03 물어볼 것.
 * 산업 카드덱과 **눈에 띄게 달라 보여야** 합니다. 산업 카드는 "업계는 대체로 이렇다"이고
 * 이 화면은 "이 회사는 실제로 이렇다"이며, 근거를 누르면 원문 섹션이 열립니다(ADR 0011).
 *
 * 브라우저 JS는 펼치기/접기와 카드 이동만 합니다(ADR 0006). 문장은 전부 생성된 HTML 안에 있습니다.
 *
 * 실행: node scripts/build-overlay.ts
 */

import {
  THEME_BASE,
  THEME_CURSOR_CSS,
  THEME_CURSOR_JS,
  THEME_HEAD,
  THEME_ROOT,
  THEME_TOPBAR_CSS,
} from "./theme.ts";
import { escapeHtml } from "./deckPage.ts";
import { OVERLAY_STATUS_LABEL_KO } from "../domain/overlay.ts";
import type { OverlayRow } from "../domain/overlay.ts";
import type { CompanyOverlay } from "../overlay/load.ts";
import type { EvidenceSpan } from "../domain/model.ts";

const esc = escapeHtml;

/** 근거 한 건과, 그 근거가 가리키는 섹션의 원문 조각. */
export interface EvidenceView {
  span: EvidenceSpan;
  /** 인용문 앞뒤를 포함한 섹션 원문 일부. 근거를 눌렀을 때 열립니다. */
  sectionExcerpt: string;
  sourceUrl: string;
  sourceTitle: string;
}

export interface OverlayRenderInput {
  overlay: CompanyOverlay;
  /** 근거 id → 원문 보기. 빌드 스크립트가 sections.json 에서 만들어 넘깁니다. */
  evidence: Map<string, EvidenceView>;
  /** 산업 카드덱으로 돌아가는 링크. */
  deckLink?: string;
}

const CSS = `
${THEME_ROOT}
${THEME_BASE}
${THEME_TOPBAR_CSS}
${THEME_CURSOR_CSS}
header{border-bottom:1px solid var(--line);background:var(--panel);position:sticky;top:0;z-index:10}
.hd{max-width:900px;margin:0 auto;padding:14px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.hd h1{font-size:16px;margin:0;font-weight:700}
.hd .sub{color:var(--muted);font-size:13px}
.hd .spacer{flex:1}
a.btn,.btn{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:2px;
 padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit;text-decoration:none;display:inline-block}
.btn:hover{border-color:var(--accent)}
main{max-width:900px;margin:0 auto;padding:26px 20px 80px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:3px;
 padding:28px 30px;box-shadow:var(--shadow);margin-bottom:26px}
.card h2{font-size:21px;margin:0 0 6px}
.card .lead{color:var(--muted);margin:0 0 20px;font-size:14.5px}
.cid{font-size:11.5px;letter-spacing:.08em;color:var(--fact);font-weight:700}
.layerbar{display:flex;gap:10px;align-items:center;background:var(--fact-soft);border:1px solid var(--line);
 border-radius:3px;padding:12px 16px;margin-bottom:24px;font-size:13.5px}
.layerbar b{color:var(--fact)}
.tag{display:inline-flex;gap:5px;align-items:center;border-radius:999px;padding:2px 10px;
 font-size:11.5px;font-weight:600;border:1px solid var(--line);white-space:nowrap}
.tag .mk{font-weight:700}
.tag.st-FACT{background:var(--fact-soft);color:var(--fact)}
.tag.st-CONFLICTING{background:var(--warn-soft);color:var(--warn)}
.tag.st-UNVERIFIED{background:var(--chip);color:var(--muted)}
.seg{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 18px;padding:0;list-style:none}
.seg li{flex:1 1 240px;border:1px solid var(--line);border-radius:2px;padding:14px 16px}
.seg .nm{font-weight:700;font-size:14.5px}
.seg .nt{color:var(--muted);font-size:13px}
.rows{display:flex;flex-direction:column;gap:14px}
.row{border:1px solid var(--line);border-radius:3px;overflow:hidden}
.row>.top{display:flex;gap:10px;align-items:flex-start;padding:14px 16px;background:var(--panel)}
.row .topic{font-weight:700;font-size:15.5px;flex:1}
.row .cmp{padding:0 16px 14px;display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:720px){.row .cmp{grid-template-columns:1fr 1fr}}
.side{border:1px dashed var(--line);border-radius:2px;padding:12px 14px}
.side h4{margin:0 0 6px;font-size:11.5px;letter-spacing:.06em;color:var(--muted);font-weight:700}
.side.ind{background:var(--bg)}
.side.co{background:var(--fact-soft)}
.side.co h4{color:var(--fact)}
.side p{margin:0;font-size:14.5px}
.side .src{margin-top:8px;font-size:12px;color:var(--muted)}
.conflict{margin:0 16px 14px;padding:12px 14px;background:var(--warn-soft);border-radius:2px;font-size:14px}
.conflict b{color:var(--warn);display:block;font-size:11.5px;letter-spacing:.05em;margin-bottom:4px}
.gap{margin:0 16px 14px;padding:12px 14px;background:var(--chip);border-radius:2px;font-size:14px}
.gap a{color:var(--fact)}
details.ev{margin-top:10px;border-top:1px dashed var(--line);padding-top:8px}
details.ev summary{cursor:pointer;font-size:12.5px;color:var(--fact);font-weight:600}
details.ev .q{margin:8px 0 0;padding:10px 12px;background:var(--bg);border-left:3px solid var(--fact);
 border-radius:0 8px 8px 0;font-size:13.5px}
details.ev .loc{font-size:11.5px;color:var(--muted);margin-top:6px}
details.ev .raw{margin-top:8px;font-size:12.5px;color:var(--muted);white-space:pre-wrap;
 max-height:220px;overflow:auto;background:var(--bg);padding:10px 12px;border-radius:2px;line-height:1.6}
.q{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px}
.qitem{border:1px solid var(--line);border-radius:3px;padding:14px 16px}
.qitem .qt{font-weight:700;font-size:15.5px;margin-bottom:6px}
.qitem .meta{font-size:13px;color:var(--muted)}
.qitem .back{margin-top:8px;font-size:13px}
.qitem .back a{color:var(--fact)}
table.mini{border-collapse:collapse;width:100%;font-size:13.5px;margin-top:6px}
table.mini th,table.mini td{border-bottom:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top}
footer{border-top:1px solid var(--line);margin-top:10px;padding:22px 20px 60px;background:var(--panel)}
.ft{max-width:900px;margin:0 auto;font-size:13px;color:var(--muted)}
.ft h3{font-size:12px;letter-spacing:.06em;margin:0 0 8px;color:var(--ink)}
.ft ul{margin:0 0 14px;padding-left:18px}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.legend div{display:flex;gap:7px;align-items:center;font-size:12.5px}
`;

const JS = `
document.addEventListener('click', function(e){
  var a = e.target.closest('a[data-jump]');
  if(!a) return;
  e.preventDefault();
  var el = document.getElementById(a.getAttribute('data-jump'));
  if(!el) return;
  el.scrollIntoView({behavior:'smooth', block:'center'});
  el.style.transition='outline-color .8s';
  el.style.outline='2px solid var(--fact)';
  setTimeout(function(){ el.style.outline='2px solid transparent'; }, 1400);
});
`;

function statusTag(row: OverlayRow): string {
  const l = OVERLAY_STATUS_LABEL_KO[row.status];
  return `<span class="tag st-${row.status}" title="${esc(l.hint)}"><span class="mk">${esc(l.mark)}</span>${esc(l.label)}</span>`;
}

function evidenceBlock(spanIds: string[], evidence: Map<string, EvidenceView>): string {
  const views = spanIds.map((id) => evidence.get(id)).filter((v): v is EvidenceView => Boolean(v));
  if (views.length === 0) return "";

  return views
    .map(
      (v) => `<details class="ev">
      <summary>근거 보기 — ${esc(v.span.section)} (섹션 ${v.span.page})</summary>
      <p class="q">${esc(v.span.quote)}</p>
      <div class="loc">${esc(v.sourceTitle)} · 섹션 ${v.span.page} · <a href="${esc(v.sourceUrl)}" target="_blank" rel="noopener">DART 원문 ↗</a></div>
      <div class="raw">${esc(v.sectionExcerpt)}</div>
    </details>`,
    )
    .join("");
}

function renderRow(row: OverlayRow, input: OverlayRenderInput): string {
  const spanIds = row.claims.flatMap((c) => c.evidence.map((e) => e.span_id));
  const question = input.overlay.questions.find((q) => q.id === row.questionId);

  const companySide =
    row.claims.length > 0
      ? `<div class="side co">
          <h4>이 회사는 실제로</h4>
          ${row.claims.map((c) => `<p>${esc(c.text)}</p>`).join("")}
          ${evidenceBlock(spanIds, input.evidence)}
        </div>`
      : `<div class="side co">
          <h4>이 회사는 실제로</h4>
          <p>공시로 확인되지 않았습니다.</p>
          <div class="src">빈칸을 채우지 않고 아래 질문으로 넘깁니다.</div>
        </div>`;

  const industryLabel = row.industry.cardId
    ? `산업 일반 — 카드 ${row.industry.cardId}`
    : `산업 일반 — 카드 없음 (개념 ${row.industry.conceptId ?? "?"})`;

  return `<div class="row" id="row-${esc(row.id)}">
    <div class="top">
      <span class="topic">${esc(row.topic)}</span>
      ${statusTag(row)}
    </div>
    <div class="cmp">
      <div class="side ind">
        <h4>${esc(industryLabel)}</h4>
        <p>${esc(row.industry.statement)}</p>
        <div class="src">비교 기준입니다. 이 회사의 근거가 아닙니다.</div>
      </div>
      ${companySide}
    </div>
    ${row.conflict ? `<div class="conflict"><b>산업 일반론과 다른 지점</b>${esc(row.conflict)}</div>` : ""}
    ${
      question
        ? `<div class="gap">물어볼 것으로 넘어갔습니다 →
             <a href="#q-${esc(question.id)}" data-jump="q-${esc(question.id)}">${esc(question.id)} ${esc(question.question)}</a>
           </div>`
        : ""
    }
  </div>`;
}

export function renderOverlayPage(input: OverlayRenderInput): string {
  const { overlay } = input;
  const { meta, profile, rows, questions } = overlay;
  const claimById = new Map(overlay.claims.map((c) => [c.id, c]));

  const counts = {
    FACT: rows.filter((r) => r.status === "FACT").length,
    CONFLICTING: rows.filter((r) => r.status === "CONFLICTING").length,
    UNVERIFIED: rows.filter((r) => r.status === "UNVERIFIED").length,
  };

  const profileClaims = profile.claimIds
    .map((id) => claimById.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const legend = (["FACT", "CONFLICTING", "UNVERIFIED"] as const)
    .map((s) => {
      const l = OVERLAY_STATUS_LABEL_KO[s];
      return `<div><span class="tag st-${s}"><span class="mk">${esc(l.mark)}</span>${esc(l.label)}</span><span>${esc(l.hint)}</span></div>`;
    })
    .join("");

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.companyName)} — 산업 표준과 무엇이 다른가</title>
${THEME_HEAD}
<style>${CSS}</style>
<header><div class="hd">
  <h1>${esc(meta.companyName)}</h1>
  <span class="sub">${esc(meta.industryLabel)} · ${esc(profile.positionLabel)} · ${esc(meta.fiscalYear)}</span>
  <span class="spacer"></span>
  <a class="btn" href="index.html">← 첫 화면</a>
  ${input.deckLink ? `<a class="btn" href="${esc(input.deckLink)}">산업 카드덱 →</a>` : ""}
  <a class="btn" href="${esc(meta.dartUrl)}" target="_blank" rel="noopener">DART 원문 ↗</a>
</div></header>
<main>

  <div class="layerbar">
    <b>여기서부터는 회사 층입니다.</b>
    <span>산업 카드는 업계 일반론이라 사실이 될 수 없습니다. 이 화면의 문장은 이 회사 공시가 직접 지지하며, 근거를 누르면 원문 섹션이 열립니다.</span>
  </div>

  <section class="card" id="CO-01">
    <div class="cid">CO-01</div>
    <h2>이 회사는 무엇을 파는가</h2>
    <p class="lead">${esc(profile.headline)}</p>
    <ul class="seg">
      ${profile.segments
        .map(
          (s) => `<li><div class="nm">${esc(s.name)}</div><div class="nt">${esc(s.note)}</div>
            ${
              s.claimId && claimById.get(s.claimId)
                ? `<p style="margin:8px 0 0;font-size:14px">${esc(claimById.get(s.claimId)!.text)}</p>${evidenceBlock(
                    claimById.get(s.claimId)!.evidence.map((e) => e.span_id),
                    input.evidence,
                  )}`
                : ""
            }
          </li>`,
        )
        .join("")}
    </ul>
    ${profileClaims
      .map(
        (c) => `<div class="side co" style="margin-bottom:12px">
          <h4>회사 확인</h4><p>${esc(c.text)}</p>
          ${c.audit_note ? `<div class="src">${esc(c.audit_note)}</div>` : ""}
          ${evidenceBlock(
            c.evidence.map((e) => e.span_id),
            input.evidence,
          )}
        </div>`,
      )
      .join("")}
  </section>

  <section class="card" id="CO-02">
    <div class="cid">CO-02</div>
    <h2>산업 표준과 다른 점</h2>
    <p class="lead">왼쪽은 산업 카드가 말하는 업계 일반론, 오른쪽은 이 회사 공시가 말하는 것입니다.
      회사 확인 ${counts.FACT}행 · 산업과 다름 ${counts.CONFLICTING}행 · 미확인 ${counts.UNVERIFIED}행.</p>
    <div class="legend">${legend}</div>
    <div class="rows">
      ${rows.map((r) => renderRow(r, input)).join("")}
    </div>
  </section>

  <section class="card" id="CO-03">
    <div class="cid">CO-03</div>
    <h2>이 회사에 물어볼 것</h2>
    <p class="lead">위 차이표에서 근거가 없어 미확인으로 남은 ${counts.UNVERIFIED}행이 그대로 올라온 것입니다.
      막연한 궁금증이 아니라 채워야 할 빈칸입니다.</p>
    <ul class="q">
      ${questions
        .map((q) => {
          const row = rows.find((r) => r.id === q.fromRow);
          return `<li class="qitem" id="q-${esc(q.id)}">
            <div class="qt">${esc(q.id)} · ${esc(q.question)}</div>
            <table class="mini">
              <tr><th style="width:120px">받을 자료</th><td>${esc(q.expectedEvidence)}</td></tr>
              <tr><th>물어볼 담당</th><td>${esc(q.ownerRole)}</td></tr>
            </table>
            <div class="back">이 질문이 나온 자리 →
              <a href="#row-${esc(q.fromRow)}" data-jump="row-${esc(q.fromRow)}">${esc(q.fromRow)} ${esc(row ? row.topic : "")}</a>
              ${row ? ` · 산업 카드의 주장: ${esc(row.industry.statement)}` : ""}
            </div>
          </li>`;
        })
        .join("")}
    </ul>
  </section>

</main>
<footer><div class="ft">
  <h3>이 화면의 한계</h3>
  <ul>${meta.limits.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
  <div>출처: ${overlay.sources.map((s) => `${esc(s.title)} (신뢰등급 ${esc(s.trust_grade)})`).join(" · ")}</div>
  <div>접수번호 ${esc(meta.receiptNo)} · 원문 스냅샷 ${esc(overlay.sources[0]?.snapshot.sha256?.slice(0, 16) ?? "")}…</div>
</div></footer>
<script>${JS}</script>
${THEME_CURSOR_JS}`;
}
