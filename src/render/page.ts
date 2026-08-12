/**
 * 거래 지도 화면을 정적 HTML로 렌더링합니다.
 *
 * 모든 내용을 서버에서 미리 만들어 두고, 브라우저 JS는 보이기/숨기기와
 * 근거 창 열기만 합니다. 화면에 나오는 모든 문장이 HTML 안에 들어 있으므로
 * tests/render.test.ts가 마크업만 보고 검사할 수 있습니다.
 *
 * 화면 규칙(CLAUDE.md):
 *  - 상태는 색만이 아니라 글자와 기호로 표시
 *  - 근거를 누르면 정확한 원문 위치가 열림
 *  - 산업 일반과 회사 특정을 다르게 표시
 *  - 미확인·상충 항목을 숨기지 않음
 *  - 위험·요청자료·질문은 근거 사슬을 드러냄
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
import type { AssertionStatus, Scope } from "../domain/types.ts";
import type { Claim, EvidenceSpan, Seed, Source, TransactionStep } from "../domain/model.ts";
import { byId } from "../seed/load.ts";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const FLOW_LABEL: Record<string, string> = {
  SERVICE: "용역",
  CASH: "현금",
  DOCUMENT: "문서",
};

export interface RenderOptions {
  /** DART 근거 후보 검토 화면이 만들어졌을 때 그 링크 */
  candidatesLink?: string;
  /** 실제 회사 사례 화면이 만들어졌을 때 그 링크 */
  companyLink?: string;
  /** 산업 카드덱. 이 화면(여행업 거래 지도)과 다른 자산이므로 링크로만 잇습니다(ADR 0009). */
  deckLinks?: { label: string; href: string }[];
  /** 회사 오버레이 화면(ADR 0011). */
  overlayLinks?: { label: string; href: string }[];
}

export function renderPage(seed: Seed, options: RenderOptions = {}): string {
  const claims = byId(seed.claims);
  const spans = byId(seed.evidenceSpans);
  const sources = byId(seed.sources);
  const actors = byId(seed.actors);
  const risks = byId(seed.risks);
  const requests = byId(seed.requestItems);
  const questions = byId(seed.interviewQuestions);

  const statusCount = (s: AssertionStatus) => seed.claims.filter((c) => c.assertion_status === s).length;

  function badge(status: AssertionStatus): string {
    const m = ASSERTION_LABEL_KO[status];
    return `<span class="badge b-${status.toLowerCase()}" title="${esc(m.hint)}"><span class="mark">${m.mark}</span>${m.label}</span>`;
  }

  function scopeTag(scope: Scope): string {
    const cls = scope === "COMPANY" ? "sc-company" : "sc-industry";
    return `<span class="scope ${cls}">${SCOPE_LABEL_KO[scope]}</span>`;
  }

  /** Claim ID를 눌러 해당 Claim으로 이동하는 칩 */
  function claimChip(id: string): string {
    const c = claims.get(id);
    if (!c) return `<span class="chip chip-missing">${esc(id)}</span>`;
    const m = ASSERTION_LABEL_KO[c.assertion_status];
    return `<button class="chip b-${c.assertion_status.toLowerCase()}" data-goto="${esc(id)}" title="${esc(c.text)}"><span class="mark">${m.mark}</span>${esc(id)}</button>`;
  }

  function evidenceBlock(c: Claim): string {
    if (c.evidence.length > 0) {
      return c.evidence
        .map((e) => {
          const span = spans.get(e.span_id) as EvidenceSpan | undefined;
          if (!span) return "";
          const src = sources.get(span.source_id) as Source | undefined;
          if (!src) return "";
          const pdf = src.snapshot.file.endsWith(".pdf")
            ? `sources/${encodeURIComponent(src.snapshot.file)}#page=${span.page}`
            : `sources/${encodeURIComponent(src.snapshot.file)}`;
          return `
            <div class="evidence">
              <button class="ev-open" data-span="${esc(span.id)}">근거 열기 · ${esc(span.id)}</button>
              <div class="ev-where">${esc(src.title)} · p.${span.page} · ${esc(span.section)}</div>
              <blockquote class="ev-quote">${esc(span.quote)}</blockquote>
              <a class="ev-link" href="${pdf}" target="_blank" rel="noopener">원문 ${span.page}쪽 열기 ↗</a>
            </div>`;
        })
        .join("");
    }

    if (c.premises.length > 0) {
      return `
        <div class="evidence evidence-inference">
          <div class="ev-where">직접 근거 없음 · 아래 전제에서 도출한 추정입니다</div>
          <div class="chips">${c.premises.map(claimChip).join("")}</div>
          ${c.inference_note ? `<p class="ev-note">${esc(c.inference_note)}</p>` : ""}
        </div>`;
    }

    const conv = c.converts_to ?? {};
    const targets = [...(conv.request_items ?? []), ...(conv.interview_questions ?? [])];
    return `
      <div class="evidence evidence-unverified">
        <div class="ev-where">근거 없음 · 숨기지 않고 확인 행동으로 넘깁니다</div>
        ${targets.length ? `<div class="chips">${targets.map((t) => `<span class="chip chip-action">${esc(t)}</span>`).join("")}</div>` : ""}
        ${
          c.blocks_resolution_of?.length
            ? `<p class="ev-note">이 항목이 확인되기 전에는 다음 추정을 결론 낼 수 없습니다: ${c.blocks_resolution_of.map(claimChip).join(" ")}</p>`
            : ""
        }
      </div>`;
  }

  // 같은 Claim이 여러 거래 단계에 나타나므로 요소 id는 단계와 함께 만듭니다.
  // Claim으로 이동할 때는 id가 아니라 data-claim 으로 찾습니다.
  function claimCard(c: Claim, stepId: string): string {
    return `
      <article class="claim" id="claim-${esc(stepId)}-${esc(c.id)}" data-claim="${esc(c.id)}" data-status="${c.assertion_status}" data-scope="${c.scope}">
        <header class="claim-head">
          ${badge(c.assertion_status)}
          ${scopeTag(c.scope)}
          <span class="claim-id">${esc(c.id)}</span>
        </header>
        <p class="claim-text">${esc(c.text)}</p>
        ${c.audit_note ? `<p class="claim-note">감사 관점: ${esc(c.audit_note)}</p>` : ""}
        ${evidenceBlock(c)}
      </article>`;
  }

  function flowRow(step: TransactionStep): string {
    return step.flows
      .map((f) => {
        const from = actors.get(f.from)?.name ?? f.from;
        const to = actors.get(f.to)?.name ?? f.to;
        return `<li class="flow flow-${f.flow_type.toLowerCase()}">
          <span class="flow-kind">${FLOW_LABEL[f.flow_type] ?? f.flow_type}</span>
          <span class="flow-from">${esc(from)}</span>
          <span class="flow-arrow">→</span>
          <span class="flow-to">${esc(to)}</span>
          <span class="flow-label">${esc(f.label)}</span>
        </li>`;
      })
      .join("");
  }

  function riskBlock(stepId: string): string {
    const stepRisks = seed.risks.filter((r) => r.step_id === stepId);
    if (stepRisks.length === 0) {
      return `<p class="empty">이 단계에 연결된 잠재 위험이 없습니다.</p>`;
    }
    return stepRisks
      .map((r) => {
        const rq = seed.requestItems.filter((x) => x.risk_ids.includes(r.id));
        const iq = seed.interviewQuestions.filter((x) => x.risk_ids.includes(r.id));
        return `
        <article class="risk" id="risk-${esc(r.id)}">
          <header class="risk-head">
            <span class="risk-id">${esc(r.id)}</span>
            <h4>${esc(r.title)}</h4>
            <span class="assertions">${r.assertions.map((a) => `<span class="tag">${esc(a)}</span>`).join("")}</span>
          </header>
          <p class="risk-text">${esc(r.risk_text)}</p>
          <div class="rationale">
            <div class="rat-line"><span class="rat-key">근거 Claim</span><span class="chips">${r.rationale_claims.map(claimChip).join("")}</span></div>
            ${r.counter_claims?.length ? `<div class="rat-line"><span class="rat-key">반대 방향</span><span class="chips">${r.counter_claims.map(claimChip).join("")}</span></div>` : ""}
            ${r.open_questions?.length ? `<div class="rat-line"><span class="rat-key">미확인</span><span class="chips">${r.open_questions.map(claimChip).join("")}</span></div>` : ""}
            <div class="rat-line"><span class="rat-key">예상 계정</span><span class="accounts">${r.accounts.map((a) => `<span class="tag">${esc(a)}</span>`).join("")}</span></div>
            ${r.note ? `<p class="risk-note">${esc(r.note)}</p>` : ""}
          </div>
          <div class="actions">
            <div class="action-col">
              <h5>요청자료 ${rq.length}건</h5>
              ${
                rq
                  .map(
                    (x) => `<div class="action" id="req-${esc(r.id)}-${esc(x.id)}">
                      <div class="action-head"><span class="action-id">${esc(x.id)}</span><span class="prio">${esc(x.priority)}</span></div>
                      <p class="action-text">${esc(x.item)}</p>
                      <p class="action-why">왜: ${esc(x.purpose)}</p>
                      <p class="action-from">출발: ${x.claim_ids.map(claimChip).join(" ")}</p>
                    </div>`,
                  )
                  .join("") || `<p class="empty">없음</p>`
              }
            </div>
            <div class="action-col">
              <h5>인터뷰 질문 ${iq.length}건</h5>
              ${
                iq
                  .map(
                    (x) => `<div class="action" id="q-${esc(r.id)}-${esc(x.id)}">
                      <div class="action-head"><span class="action-id">${esc(x.id)}</span><span class="prio">${esc(x.owner_role)}</span></div>
                      <p class="action-text">${esc(x.question)}</p>
                      <p class="action-why">기대 근거: ${esc(x.expected_evidence)}</p>
                      <p class="action-why">후속: ${esc(x.follow_up_rule)}</p>
                      <p class="action-from">출발: ${x.claim_ids.map(claimChip).join(" ")}</p>
                    </div>`,
                  )
                  .join("") || `<p class="empty">없음</p>`
              }
            </div>
          </div>
        </article>`;
      })
      .join("");
  }

  const stepNav = seed.steps
    .map(
      (s, i) => `<button class="step-btn${i === 0 ? " active" : ""}" data-step="${esc(s.id)}">
        <span class="step-seq">${s.sequence}</span>
        <span class="step-name">${esc(s.name)}</span>
        <span class="step-count">${s.claims.length}</span>
      </button>`,
    )
    .join("");

  const stepPanels = seed.steps
    .map((s, i) => {
      const stepClaims = s.claims.map((id) => claims.get(id)).filter((c): c is Claim => Boolean(c));
      const order: AssertionStatus[] = ["FACT", "INFERENCE", "UNVERIFIED", "CONFLICTING"];
      const sorted = [...stepClaims].sort(
        (a, b) => order.indexOf(a.assertion_status) - order.indexOf(b.assertion_status),
      );
      return `
      <section class="step-panel${i === 0 ? " active" : ""}" data-step-panel="${esc(s.id)}">
        <div class="step-head">
          <h2><span class="step-seq big">${s.sequence}</span> ${esc(s.name)}</h2>
          <dl class="step-meta">
            <div><dt>시작 조건</dt><dd>${esc(s.trigger)}</dd></div>
            <div><dt>완료 조건</dt><dd>${esc(s.completion_condition)}</dd></div>
          </dl>
        </div>

        <div class="two-col">
          <div class="col">
            <h3>참여자와 흐름</h3>
            <ul class="flows">${flowRow(s)}</ul>

            <h3>이 단계의 근거 (${sorted.length})</h3>
            <div class="claims">${sorted.map((c) => claimCard(c, s.id)).join("")}</div>
          </div>
          <div class="col">
            <h3>잠재 위험과 확인 행동</h3>
            ${riskBlock(s.id)}
          </div>
        </div>
      </section>`;
    })
    .join("");

  const spanData = JSON.stringify(
    Object.fromEntries(
      seed.evidenceSpans.map((s) => {
        const src = sources.get(s.source_id) as Source;
        return [
          s.id,
          {
            quote: s.quote,
            page: s.page,
            section: s.section,
            sourceTitle: src.title,
            publisher: src.publisher,
            grade: src.trust_grade,
            fetched: src.snapshot.fetched_at,
            sha256: src.snapshot.sha256,
            file: src.snapshot.file,
            limitations: src.limitations ?? "",
            canSupport: src.can_support_scope.map((x) => SCOPE_LABEL_KO[x]).join(", "),
          },
        ];
      }),
    ),
  ).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>감사맥락AI — ${esc(seed.case.company_name)} BSP 거래 지도</title>
${THEME_FONTS}
<style>
${THEME_ROOT}
${THEME_BASE}
${THEME_TOPBAR_CSS}
${THEME_CURSOR_CSS}
header.top{background:var(--panel);border-bottom:1px solid var(--line);padding:14px 20px}
.title-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:12px}
h1{font-size:18px;margin:0}
.period{color:var(--muted)}
.nav-links{margin-left:auto;display:flex;gap:16px;flex-wrap:wrap}
.nav-link{color:var(--industry);font-weight:700}
.warn{margin-top:10px;padding:9px 12px;border:1px solid #d9b25a;background:#fdf6e3;border-radius:2px}
.counts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.count{border:1px solid var(--line);border-radius:20px;padding:3px 11px;background:#fff}
.count .mark{font-weight:700;margin-right:5px}

.layout{display:grid;grid-template-columns:250px 1fr;gap:0;align-items:start}
nav.steps{background:var(--panel);border-right:1px solid var(--line);min-height:calc(100vh - 120px);padding:10px}
nav.steps h3{font-size:12px;color:var(--muted);margin:6px 8px 8px;letter-spacing:.04em}
.step-btn{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;width:100%;text-align:left;
  background:none;border:1px solid transparent;border-radius:2px;padding:9px 10px;cursor:pointer;font:inherit;color:inherit;margin-bottom:2px}
.step-btn:hover{background:#eef2f6}
.step-btn.active{background:#e7eff7;border-color:#9bb6d0;font-weight:700}
.step-seq{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--industry);color:#fff;font-size:12px}
.step-seq.big{width:26px;height:26px}
.step-count{color:var(--muted);font-size:12px}

main{padding:18px 22px 60px}
.step-panel{display:none}
.step-panel.active{display:block}
.step-head h2{display:flex;align-items:center;gap:10px;margin:0 0 8px;font-size:19px}
.step-meta{display:flex;gap:26px;flex-wrap:wrap;margin:0 0 14px}
.step-meta div{display:flex;gap:8px}
.step-meta dt{color:var(--muted);margin:0}
.step-meta dd{margin:0}

.two-col{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px}
@media (max-width:1100px){.layout{grid-template-columns:1fr}.two-col{grid-template-columns:1fr}nav.steps{min-height:0}}
h3{font-size:14px;margin:18px 0 8px}
h4{font-size:14px;margin:0}
h5{font-size:12.5px;color:var(--muted);margin:0 0 6px}

.flows{list-style:none;margin:0;padding:0}
.flow{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line);
  border-left-width:4px;border-radius:2px;padding:7px 10px;margin-bottom:5px}
.flow-cash{border-left-color:var(--fact)}.flow-service{border-left-color:var(--industry)}.flow-document{border-left-color:var(--inference)}
.flow-kind{font-size:11px;border:1px solid var(--line);border-radius:4px;padding:1px 6px;color:var(--muted)}
.flow-arrow{color:var(--muted)}
.flow-label{color:var(--muted)}

.claim{background:var(--panel);border:1px solid var(--line);border-radius:2px;padding:11px 13px;margin-bottom:9px}
.claim-head{display:flex;align-items:center;gap:7px;margin-bottom:6px}
.claim-id{margin-left:auto;color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}
.claim-text{margin:0 0 7px}
.claim-note{margin:0 0 7px;color:var(--muted);font-size:13px;border-left:3px solid var(--line);padding-left:8px}

.badge{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:1px 8px;font-size:12.5px;font-weight:700;border:1px solid}
.badge .mark{font-size:13px}
.b-fact{color:var(--fact);border-color:var(--fact);background:#eaf4ee}
.b-inference{color:var(--inference);border-color:var(--inference);background:#fbf3e0}
.b-unverified{color:var(--unverified);border-color:var(--unverified);background:#f6ecf8}
.b-conflicting{color:var(--conflict);border-color:var(--conflict);background:#fbecec}
.scope{font-size:11.5px;border-radius:4px;padding:1px 7px;border:1px dashed}
.sc-industry{color:var(--industry);border-color:var(--industry)}
.sc-company{color:var(--company);border-color:var(--company)}

.evidence{border-top:1px dashed var(--line);padding-top:8px;margin-top:6px}
.ev-where{color:var(--muted);font-size:12.5px;margin-bottom:5px}
.ev-quote{margin:0 0 6px;padding:7px 10px;background:#f2f5f8;border-left:3px solid #9bb6d0;border-radius:0 5px 5px 0;
  font-size:13px;white-space:pre-wrap}
.ev-open{font:inherit;font-size:12.5px;cursor:pointer;background:var(--industry);color:#fff;border:0;border-radius:2px;padding:4px 10px;margin-bottom:6px}
.ev-link{font-size:12.5px}
.ev-note{margin:6px 0 0;font-size:12.5px;color:var(--muted)}
.evidence-inference{border-top-color:var(--inference)}
.evidence-unverified{border-top-color:var(--unverified)}

.chips{display:inline-flex;flex-wrap:wrap;gap:4px}
.chip{font:inherit;font-size:12px;border-radius:4px;padding:1px 7px;border:1px solid var(--line);background:#fff;cursor:pointer}
.chip .mark{margin-right:3px}
.chip-action{background:#f6ecf8;border-color:var(--unverified);color:var(--unverified);cursor:default}
.chip-missing{background:#fbecec;border-color:var(--conflict);color:var(--conflict)}

.risk{background:var(--panel);border:1px solid var(--line);border-radius:2px;padding:12px 14px;margin-bottom:12px}
.risk-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.risk-id{color:var(--muted);font-size:12px}
.tag{font-size:11.5px;border:1px solid var(--line);border-radius:4px;padding:1px 6px;color:var(--muted)}
.risk-text{margin:0 0 8px}
.rationale{background:#f8fafc;border:1px solid var(--line);border-radius:2px;padding:8px 10px;margin-bottom:10px}
.rat-line{display:flex;gap:8px;align-items:baseline;margin-bottom:4px;flex-wrap:wrap}
.rat-key{color:var(--muted);font-size:12px;min-width:66px}
.risk-note{margin:6px 0 0;font-size:12.5px;color:var(--muted)}
.actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:820px){.actions{grid-template-columns:1fr}}
.action{border:1px solid var(--line);border-radius:2px;padding:8px 10px;margin-bottom:7px;background:#fff}
.action-head{display:flex;justify-content:space-between;color:var(--muted);font-size:11.5px;margin-bottom:3px}
.action-text{margin:0 0 4px}
.action-why,.action-from{margin:0;font-size:12.5px;color:var(--muted)}
.empty{color:var(--muted);font-size:13px}

dialog{border:1px solid var(--line);border-radius:2px;padding:0;max-width:720px;width:92vw}
dialog::backdrop{background:rgba(20,28,38,.45)}
.dlg-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line)}
.dlg-body{padding:14px 16px}
.dlg-body dt{color:var(--muted);font-size:12px}
.dlg-body dd{margin:0 0 8px}
.dlg-close{font:inherit;cursor:pointer;border:1px solid var(--line);background:#fff;border-radius:2px;padding:3px 10px}
.hash{font-family:Consolas,monospace;font-size:11.5px;word-break:break-all;color:var(--muted)}
.flash{animation:flash 1.4s ease-out}
@keyframes flash{0%{background:#fff6cc}100%{background:transparent}}
</style>
</head>
<body>
<header class="top">
  <div class="title-row">
    <h1>${esc(seed.case.company_name)} · BSP 거래 지도</h1>
    <span class="period">${esc(seed.case.industry)} · ${esc(seed.case.period_start)} ~ ${esc(seed.case.period_end)}</span>
    <span class="nav-links">
      ${options.companyLink ? `<a class="nav-link" href="${esc(options.companyLink)}">실제 회사 사례 (하나투어 공시) →</a>` : ""}
      ${options.candidatesLink ? `<a class="nav-link" href="${esc(options.candidatesLink)}">근거 후보 검토 →</a>` : ""}
      ${(options.deckLinks ?? [])
        .map((d) => `<a class="nav-link" href="${esc(d.href)}">${esc(d.label)} 온보딩 카드덱 →</a>`)
        .join("")}
      ${(options.overlayLinks ?? [])
        .map((o) => `<a class="nav-link" href="${esc(o.href)}">${esc(o.label)} 회사 차이표 →</a>`)
        .join("")}
    </span>
  </div>
  <div class="counts">
    ${(["FACT", "INFERENCE", "UNVERIFIED", "CONFLICTING"] as AssertionStatus[])
      .map(
        (s) =>
          `<span class="count b-${s.toLowerCase()}"><span class="mark">${ASSERTION_LABEL_KO[s].mark}</span>${ASSERTION_LABEL_KO[s].label} ${statusCount(s)}</span>`,
      )
      .join("")}
  </div>
  <p class="warn"><strong>가상 사례입니다.</strong> ${esc(seed.case.fiction_policy.consequence)} 회사에 관한 문장이 전부 추정·미확인인 것은 결함이 아니라 의도된 상태입니다.</p>
</header>

<div class="layout">
  <nav class="steps">
    <h3>거래 단계</h3>
    ${stepNav}
  </nav>
  <main>
    ${stepPanels}
  </main>
</div>

<dialog id="ev-dialog">
  <div class="dlg-head"><strong id="dlg-title">근거</strong><button class="dlg-close" id="dlg-close">닫기</button></div>
  <div class="dlg-body">
    <dl>
      <dt>원문 발췌</dt><dd><blockquote class="ev-quote" id="dlg-quote"></blockquote></dd>
      <dt>출처</dt><dd id="dlg-source"></dd>
      <dt>위치</dt><dd id="dlg-loc"></dd>
      <dt>이 출처가 뒷받침할 수 있는 범위</dt><dd id="dlg-scope"></dd>
      <dt>한계</dt><dd id="dlg-lim"></dd>
      <dt>스냅샷 해시(SHA-256)</dt><dd class="hash" id="dlg-hash"></dd>
    </dl>
    <a id="dlg-link" href="#" target="_blank" rel="noopener">원문 파일 열기 ↗</a>
  </div>
</dialog>

<script>
const SPANS = ${spanData};

document.querySelectorAll(".step-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.step;
    document.querySelectorAll(".step-btn").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".step-panel").forEach((p) => p.classList.toggle("active", p.dataset.stepPanel === id));
    window.scrollTo({ top: 0 });
  });
});

const dlg = document.getElementById("ev-dialog");
document.getElementById("dlg-close").addEventListener("click", () => dlg.close());

document.addEventListener("click", (e) => {
  const open = e.target.closest(".ev-open");
  if (open) {
    const s = SPANS[open.dataset.span];
    if (!s) return;
    document.getElementById("dlg-title").textContent = "근거 " + open.dataset.span;
    document.getElementById("dlg-quote").textContent = s.quote;
    document.getElementById("dlg-source").textContent = s.sourceTitle + " — " + s.publisher + " (등급 " + s.grade + ", 수집 " + s.fetched + ")";
    document.getElementById("dlg-loc").textContent = "p." + s.page + " · " + s.section;
    document.getElementById("dlg-scope").textContent = s.canSupport;
    document.getElementById("dlg-lim").textContent = s.limitations || "기록된 한계 없음";
    document.getElementById("dlg-hash").textContent = s.sha256 || "(해시 없음)";
    const link = document.getElementById("dlg-link");
    link.href = "sources/" + encodeURIComponent(s.file) + (s.file.endsWith(".pdf") ? "#page=" + s.page : "");
    dlg.showModal();
    return;
  }

  const goto = e.target.closest("[data-goto]");
  if (goto) {
    const id = goto.dataset.goto;
    const sel = '[data-claim="' + id + '"]';
    const panel = document.querySelector(".step-panel.active " + sel) || document.querySelector(sel);
    if (!panel) return;
    const owner = panel.closest(".step-panel");
    if (owner && !owner.classList.contains("active")) {
      document.querySelector('.step-btn[data-step="' + owner.dataset.stepPanel + '"]').click();
    }
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
    panel.classList.remove("flash");
    void panel.offsetWidth;
    panel.classList.add("flash");
  }
});
</script>
${THEME_CURSOR_JS}
</body>
</html>
`;
}
