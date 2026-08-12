/**
 * 첫 화면. 이 도구가 무엇이고 무엇을 하지 않는지를 먼저 말하고, 산업을 고르게 합니다.
 *
 * 자산이 셋(거래 지도·카드덱·회사 오버레이)이라 입구가 흩어져 있었습니다.
 * 쓰는 사람에게는 "내가 맡은 산업" 하나가 입구여야 하므로 한 드롭다운으로 모읍니다.
 * 다만 **종류가 다르다는 사실은 숨기지 않고** 항목에 그대로 적습니다.
 *
 * 실행: node scripts/build.ts
 */

import { escapeHtml } from "./deckPage.ts";
import { THEME_CSS, THEME_CURSOR_JS, THEME_FONTS, THEME_TOPBAR } from "./theme.ts";

const esc = escapeHtml;

/** 드롭다운 한 줄. kind 는 그 산업에서 열리는 화면의 종류입니다. */
export interface HomeIndustry {
  label: string;
  href: string;
  kind: "카드덱" | "거래 지도";
  detail: string;
}

export interface HomeCompany {
  label: string;
  href: string;
  detail: string;
}

export interface HomeInput {
  industries: HomeIndustry[];
  companies: HomeCompany[];
  /** 근거 후보 검토 화면처럼 산업과 짝이 아닌 화면. */
  tools: { label: string; href: string }[];
}

const CSS =
  THEME_CSS +
  `
.wrap{max-width:46em;margin:0 auto;padding:34px 20px 90px}
/* 제호는 포트폴리오처럼 굵은 산세리프 대문자로 세웁니다 */
h1{font-family:inherit;font-weight:900;font-size:clamp(26px,3.6vw,40px);line-height:1.2;
 margin:0 0 14px;letter-spacing:-.03em}
.tag1{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);
 font-weight:700;margin-bottom:12px}
/* 설명 문장만 세리프로 — 포트폴리오의 인용문과 같은 결입니다 */
.sub{font-family:"Noto Serif KR",serif;color:var(--muted);font-size:16px;line-height:1.85;
 margin:0 0 38px}
.sub b{color:var(--ink);font-weight:600}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:3px;
 padding:26px 28px;margin-bottom:18px}
@media(max-width:640px){.panel{padding:20px 16px}.wrap{padding:24px 16px 70px}}
.panel h2{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
 color:var(--muted);margin:0 0 16px}
label{display:block;font-size:12.5px;color:var(--muted);margin-bottom:7px}
select{width:100%;border:1px solid var(--line);background:var(--bg);color:var(--ink);
 border-radius:2px;padding:13px 14px;font-size:15.5px;font-family:inherit;cursor:pointer}
select:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent)}
.go{width:100%;margin-top:14px;background:var(--accent);color:#fff;border:0;border-radius:2px;
 padding:14px;font-size:15px;font-weight:700;letter-spacing:.02em;cursor:pointer;
 font-family:inherit;transition:background-color .2s ease}
.go:hover:not(:disabled){background:var(--conflict)}
.go:disabled{opacity:.32;cursor:default}
.pick{font-size:13px;color:var(--muted);margin-top:12px;min-height:1.6em}
/* 안쪽 칸은 각자 여백을 지우고, 감싸는 상자가 다른 칸과 같은 18px 을 갖습니다.
   (감싸는 상자에 안 주면 아래 칸과 딱 붙습니다) */
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}
@media(max-width:640px){.two{grid-template-columns:1fr}}
.two .panel{margin:0}
ul{margin:0;padding-left:18px}
li{margin:9px 0;font-size:14.5px;line-height:1.7}
.does li::marker{color:var(--fact)}
.doesnt li::marker{color:var(--conflict)}
.links{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}
.links a{border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:2px;
 padding:10px 14px;font-size:13.5px;font-weight:600;text-decoration:none;
 transition:border-color .2s ease,color .2s ease}
.links a:hover{border-color:var(--accent);color:var(--accent)}
.note{font-size:13px;color:var(--muted);line-height:1.75}
.note b{color:var(--ink);font-weight:600}
footer{border-top:1px solid var(--line);margin-top:16px;padding-top:20px}
`;

export function renderHomePage(input: HomeInput): string {
  const options = input.industries
    .map(
      (i) =>
        `<option value="${esc(i.href)}" data-detail="${esc(i.detail)}">` +
        `${esc(i.label)} — ${esc(i.kind)}</option>`,
    )
    .join("");

  const companyLinks = input.companies
    .map((c) => `<a href="${esc(c.href)}">${esc(c.label)} — ${esc(c.detail)}</a>`)
    .join("");

  const toolLinks = input.tools.map((t) => `<a href="${esc(t.href)}">${esc(t.label)}</a>`).join("");

  return (
    `<!DOCTYPE html>\n<html lang="ko"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>감사맥락AI — 감사 투입 전에 무엇을 물어볼지 정하는 도구</title>` +
    `<meta name="description" content="낯선 산업에 감사 투입되기 전, 산업 구조를 익히고 회사 공시와 대조해 물어볼 것을 정리하는 도구입니다.">` +
    THEME_FONTS +
    `\n<style>${CSS}</style></head><body>\n` +
    THEME_TOPBAR +
    `<div class="wrap">` +
    `<div class="tag1">감사맥락AI</div>` +
    `<h1>낯선 산업에 투입되기 전,<br>무엇을 물어볼지 정하는 도구</h1>` +
    `<p class="sub">감사인이 처음 만나는 산업에서 막히는 것은 근거가 없어서가 아니라 말이 통하지 않아서입니다. ` +
    `산업 구조를 먼저 익히고, 그 위에 회사 공시를 얹어 <b>산업 일반론과 이 회사가 어디서 갈라지는지</b>를 봅니다.</p>` +
    /* 산업 고르기 */
    `<div class="panel">` +
    `<h2>어느 산업을 맡으셨나요</h2>` +
    `<label for="ind">산업</label>` +
    `<select id="ind"><option value="">— 고르십시오 —</option>${options}</select>` +
    `<p class="pick" id="pick"></p>` +
    `<button class="go" type="button" id="go" disabled>시작하기</button>` +
    `<p class="note" style="margin-top:14px">여기 나오는 <b>${input.industries.length}개가 지금 자료를 넣은 산업의 전부</b>입니다. ` +
    `목록에 없는 산업은 이 도구가 아직 답할 수 없다는 뜻이며, 빈 항목을 만들지 않습니다.</p>` +
    `</div>` +
    /* 하는 일 / 하지 않는 일 */
    `<div class="two">` +
    `<div class="panel"><h2>하는 일</h2><ul class="does">` +
    `<li>산업의 거래 구조를 카드로 읽습니다</li>` +
    `<li>회사 공시(DART)를 받아 원문 위치까지 남깁니다</li>` +
    `<li>산업 일반론과 회사 사실을 나란히 놓고 차이를 봅니다</li>` +
    `<li>근거가 없는 항목을 <b>물어볼 질문</b>으로 바꿉니다</li>` +
    `</ul></div>` +
    `<div class="panel"><h2>하지 않는 일</h2><ul class="doesnt">` +
    `<li>회계처리 적정성 판단이나 감사 의견</li>` +
    `<li>근거 없이 빈칸을 채우는 일</li>` +
    `<li>산업 일반론을 회사 사실로 올리는 일</li>` +
    `<li>사람이 검토하지 않은 문장을 화면에 내보내는 일</li>` +
    `</ul></div>` +
    `</div>` +
    /* 회사 오버레이 */
    (input.companies.length
      ? `<div class="panel"><h2>회사 층이 준비된 회사</h2>` +
        `<p class="note" style="margin-bottom:12px">산업 카드는 업계 일반론이라 사실이 될 수 없습니다. ` +
        `아래 화면의 문장은 그 회사 공시가 직접 지지하며, <b>근거를 누르면 원문 섹션이 열립니다.</b></p>` +
        `<div class="links">${companyLinks}</div></div>`
      : "") +
    /* 도구 */
    (input.tools.length
      ? `<div class="panel"><h2>그 밖의 화면</h2><div class="links">${toolLinks}</div></div>`
      : "") +
    /* 한계 */
    `<div class="panel"><h2>읽기 전에 알아야 할 것</h2><p class="note">` +
    `산업 카드는 <b>2차 자료(공개 강의)</b>에서 만든 산업 일반론입니다. 감사 판단의 근거가 아니라 합리성 검증의 기준선으로만 쓰십시오. ` +
    `회사 화면의 문장만 공시 원문이 직접 지지하며, 그 둘은 화면에서 다르게 표시됩니다. ` +
    `이 도구는 감사 준비를 돕고, 결론을 대신 내리지 않습니다.` +
    `</p><footer><p class="note">공개 자료만 씁니다. 회사 내부 자료나 감사조서는 들어 있지 않습니다.</p></footer></div>` +
    `</div>\n` +
    `<script>(function(){` +
    `var s=document.getElementById("ind"),g=document.getElementById("go"),p=document.getElementById("pick");` +
    `function sync(){` +
    `var o=s.options[s.selectedIndex];` +
    `g.disabled=!s.value;` +
    `p.textContent=s.value?o.getAttribute("data-detail"):"";}` +
    `s.addEventListener("change",sync);` +
    `g.addEventListener("click",function(){if(s.value)location.href=s.value;});` +
    `sync();})();</script>\n` +
    THEME_CURSOR_JS +
    `\n</body></html>\n`
  );
}
