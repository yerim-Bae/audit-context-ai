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

const CSS = `
:root{
 --bg:#faf9f7; --panel:#fff; --ink:#1f2328; --muted:#6b7280; --line:#e6e3de;
 --accent:#2f5d50; --accent-soft:#eaf1ee; --warn:#8a5a2b; --warn-soft:#fdf3e7;
 --fact:#1d4ed8; --fact-soft:#e8eefc; --chip:#f3f1ed;
 --shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.05);
}
@media(prefers-color-scheme:dark){:root{
 --bg:#16181c; --panel:#1e2126; --ink:#e8e6e3; --muted:#9aa0a6; --line:#2e3238;
 --accent:#7fb3a2; --accent-soft:#20302b; --warn:#d9a45b; --warn-soft:#2c2419;
 --fact:#8fb4ff; --fact-soft:#1b2438; --chip:#262a30;
 --shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.35);}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
 font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Malgun Gothic",sans-serif;
 line-height:1.75;font-size:16px;-webkit-font-smoothing:antialiased}
.wrap{max-width:760px;margin:0 auto;padding:56px 20px 90px}
h1{font-size:30px;line-height:1.3;margin:0 0 10px;letter-spacing:-.02em}
.tag1{font-size:12.5px;letter-spacing:.1em;color:var(--accent);font-weight:700;margin-bottom:10px}
.sub{color:var(--muted);font-size:17px;margin:0 0 34px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:16px;
 padding:30px 32px;box-shadow:var(--shadow);margin-bottom:22px}
@media(max-width:640px){.panel{padding:22px 18px}.wrap{padding:32px 16px 70px}}
.panel h2{font-size:17px;margin:0 0 14px;letter-spacing:-.01em}
label{display:block;font-size:13px;color:var(--muted);margin-bottom:7px}
select{width:100%;border:1px solid var(--line);background:var(--bg);color:var(--ink);
 border-radius:10px;padding:13px 14px;font-size:16px;font-family:inherit;cursor:pointer}
select:focus{outline:2px solid var(--accent-soft);border-color:var(--accent)}
.go{width:100%;margin-top:14px;background:var(--accent);color:#fff;border:0;border-radius:10px;
 padding:14px;font-size:16px;font-weight:600;cursor:pointer;font-family:inherit}
.go:disabled{opacity:.4;cursor:default}
.pick{font-size:13.5px;color:var(--muted);margin-top:12px;min-height:1.6em}
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:640px){.two{grid-template-columns:1fr}}
.two .panel{margin:0}
ul{margin:0;padding-left:19px}
li{margin:7px 0;font-size:15px}
.does li::marker{color:var(--accent)}
.doesnt li::marker{color:var(--warn)}
.links{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}
.links a{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:9px;
 padding:9px 14px;font-size:14px;text-decoration:none}
.links a:hover{border-color:var(--accent);background:var(--accent-soft)}
.note{font-size:13px;color:var(--muted);line-height:1.7}
.note b{color:var(--ink)}
footer{border-top:1px solid var(--line);margin-top:14px;padding-top:20px}
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
    `\n<style>${CSS}</style></head><body>\n` +
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
    `sync();})();</script>\n</body></html>\n`
  );
}
