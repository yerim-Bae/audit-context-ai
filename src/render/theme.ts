/**
 * 화면 공통 테마.
 *
 * 화면을 만드는 파일이 여섯이고 그동안 각자 :root 를 들고 있어서 팔레트가 세 갈래로
 * 갈라져 있었습니다. 색과 활자는 여기 한 곳에서만 정하고, 각 파일은 가져다 씁니다.
 *
 * 값은 포트폴리오 사이트(yerim-accounting)와 같습니다. 두 사이트를 오가도 같은
 * 곳으로 읽히게 하려는 것입니다.
 *
 * ■ 기능색은 브랜드색으로 덮지 않습니다
 *   이 도구는 확인·추론·미확인·상충 상태와 산업 일반/회사 특정 층위를 색으로도
 *   구분합니다(CLAUDE.md 화면 규칙). 전부 주황으로 바꾸면 그 구분이 사라지므로,
 *   아이보리 배경에서 읽히도록 명도만 맞추고 서로 다른 성질은 그대로 둡니다.
 */

/** 색 토큰. 각 화면의 :root 자리에 그대로 들어갑니다. */
export const THEME_ROOT = `
:root{
 /* ---- 바탕과 글자 (포트폴리오와 같은 값) ---- */
 --bg:#F5F1EB; --panel:#FBF9F5; --ink:#1C1A19;
 --muted:rgba(28,26,25,.60); --line:rgba(28,26,25,.14);
 --chip:#EFEAE2; --shadow:none;
 /* ---- 브랜드 강조 ---- */
 --accent:#D8662F; --accent-soft:#F6E4D8;
 /* ---- 기능색: 상태 ---- */
 --fact:#2F6B4F; --fact-soft:#E7EFEA;      /* 확인된 사실 */
 --inference:#8A6112;                       /* 추론 */
 --unverified:#6B4A8A;                      /* 미확인 */
 --conflict:#A22B22;                        /* 상충 */
 --warn:#8A5524; --warn-soft:#F3E7D9;       /* 주의 */
 /* ---- 기능색: 층위 ---- */
 --company:#6B4A8A;                         /* 회사 특정 */
 --industry:#3B5A73;                        /* 산업 일반 */
}
`;

/**
 * <head> 에 공통으로 들어가는 것 — 탭 아이콘과 글꼴.
 *
 * 아이콘은 포트폴리오와 같은 주황 Y 입니다. 이 사이트는 도메인 뿌리가 아니라
 * /audit-context-ai/ 아래에 있어서, 브라우저가 저절로 찾는 /favicon.ico 로는
 * 닿지 않습니다. 그래서 링크로 직접 가리킵니다.
 */
export const THEME_HEAD =
  `<link rel="icon" href="assets/favicon.ico" sizes="any">` +
  `<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">` +
  `<link rel="apple-touch-icon" sizes="180x180" href="assets/favicon-180.png">` +
  `<link rel="preconnect" href="https://fonts.googleapis.com">` +
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
  `<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&display=swap" rel="stylesheet">` +
  `<link rel="stylesheet" as="style" crossorigin ` +
  `href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">`;

/**
 * 기본 활자와 읽기 규칙. 각 화면의 body{...} 자리에 들어갑니다.
 *
 * word-break:keep-all 이 이번 변경에서 가장 큰 가독성 개선입니다.
 * 이것이 없으면 한글이 어절 한가운데에서 잘려 다음 줄로 넘어갑니다.
 */
export const THEME_BASE = `
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
 font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,
   "Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
 font-size:15.5px;line-height:1.75;-webkit-font-smoothing:antialiased;
 word-break:keep-all;overflow-wrap:anywhere}
/* 제목은 조금 더 조여서 덩어리로 읽히게 합니다 */
h1,h2,h3,h4{word-break:keep-all;letter-spacing:-.02em;line-height:1.35}
/* 표·코드처럼 잘려도 되는 곳은 예외 */
code,pre,td,th{overflow-wrap:break-word}
a{color:inherit}
::selection{background:var(--accent-soft)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
`;

/**
 * 커서 — 주황 점, 누를 수 있는 것 위에서는 링.
 * 포트폴리오의 네 페이지와 같은 커서입니다. 마우스가 있는 기기에서만 켜집니다.
 */
export const THEME_CURSOR_CSS = `
@media (hover:hover) and (pointer:fine){
 body,body *{cursor:none!important}
 body input,body textarea,body select,body [contenteditable],body iframe{cursor:auto!important}
 #cur{position:fixed;top:0;left:0;z-index:2147483000;pointer-events:none;
  transform:translate3d(-100px,-100px,0);will-change:transform}
 #cur i{display:block;box-sizing:border-box;width:10px;height:10px;margin:-5px 0 0 -5px;
  border-radius:50%;background:var(--accent);border:1.5px solid transparent;opacity:0;
  transition:width .24s cubic-bezier(.22,.7,.3,1),height .24s cubic-bezier(.22,.7,.3,1),
   margin .24s cubic-bezier(.22,.7,.3,1),background-color .24s ease,border-color .24s ease,
   transform .16s ease,opacity .18s ease}
 #cur.on i{opacity:1}
 #cur.ring i{width:32px;height:32px;margin:-16px 0 0 -16px;background:transparent;
  border-color:var(--accent)}
 #cur.press i{transform:scale(.78)}
 @media (prefers-reduced-motion:reduce){ #cur i{transition:opacity .18s ease} }
}
`;

/**
 * 커서 스크립트의 알맹이(태그 없음).
 *
 * 카드덱 화면은 script 태그가 "데이터 1개 + 동작 1개" 여야 합니다. 주입한 JSON 이
 * </script> 로 일찍 닫히지 않았는지 태그 수로 검사하기 때문입니다
 * (tests/pack-integrity.test.ts). 그래서 태그를 늘리지 않고 기존 동작 스크립트
 * 안에 이 알맹이를 이어 붙입니다.
 */
export const THEME_CURSOR_SRC =
  `(function(){` +
  `if(!matchMedia("(hover:hover) and (pointer:fine)").matches)return;` +
  `var el=document.createElement("div");el.id="cur";el.setAttribute("aria-hidden","true");` +
  `el.innerHTML="<i></i>";document.body.appendChild(el);` +
  `var HIT='a[href],button:not([disabled]),[role="button"],label,summary,select,[data-goto]';` +
  `var x=0,y=0,raf=0;function draw(){raf=0;el.style.transform="translate3d("+x+"px,"+y+"px,0)";}` +
  `addEventListener("mousemove",function(e){x=e.clientX;y=e.clientY;` +
  `if(!raf)raf=requestAnimationFrame(draw);var t=e.target;el.classList.add("on");` +
  `el.classList.toggle("ring",!!(t.closest&&t.closest(HIT)));},{passive:true});` +
  `addEventListener("mousedown",function(){el.classList.add("press");},{passive:true});` +
  `addEventListener("mouseup",function(){el.classList.remove("press");},{passive:true});` +
  `document.addEventListener("mouseleave",function(){el.classList.remove("on");});` +
  `addEventListener("blur",function(){el.classList.remove("on","press");});` +
  `})();`;

/** 태그까지 씌운 것. script 태그를 늘려도 되는 화면에서 </body> 앞에 넣습니다. */
export const THEME_CURSOR_JS = `<script>${THEME_CURSOR_SRC}</script>`;

/** 화면 왼쪽 위 워드마크. 누르면 포트폴리오로 돌아갑니다. */
export const THEME_TOPBAR_CSS = `
.ymark{display:block;padding:clamp(18px,2.4vw,28px) clamp(18px,3vw,36px) 0}
.ymark a{display:inline-flex;align-items:center;
 transition:transform .18s cubic-bezier(.22,1,.36,1),opacity .18s ease}
.ymark img{display:block;height:26px;width:auto}
.ymark a:hover,.ymark a:focus-visible{transform:translateX(-4px);opacity:.85}
@media(max-width:640px){.ymark img{height:22px}}
`;

/** 워드마크 마크업. <body> 바로 뒤에 넣습니다. */
export const THEME_TOPBAR =
  `<div class="ymark"><a href="https://yerim-accounting.vercel.app/#assurance" ` +
  `aria-label="배예림 포트폴리오로 돌아가기">` +
  `<img src="assets/wordmark.png" alt="Yerim" width="220" height="96"></a></div>`;

/* =========================================================================
   공지 창
   화면 왼쪽에 붙습니다. 글을 왼쪽부터 읽으니 눈이 먼저 닿는 자리입니다.
   좁은 화면에서는 아래쪽 전체 폭으로 바뀝니다.
   ========================================================================= */
export const THEME_NOTICE_CSS = `
.nt-veil{position:fixed;inset:0;z-index:2147482000;background:rgba(28,26,25,.26);
 opacity:0;transition:opacity .24s ease}
.nt-veil.on{opacity:1}
.nt{position:fixed;z-index:2147482100;left:clamp(16px,3vw,44px);top:50%;
 transform:translateY(-50%) translateX(-20px);width:min(460px,calc(100vw - 32px));
 background:var(--panel);border:1px solid var(--ink);border-top:3px solid var(--accent);
 padding:32px 34px 26px;opacity:0;
 transition:opacity .26s ease,transform .26s cubic-bezier(.22,1,.36,1)}
.nt.on{opacity:1;transform:translateY(-50%) translateX(0)}
.nt-kicker{font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;
 color:var(--accent);margin:0 0 12px}
.nt h2{font-size:23px;font-weight:800;letter-spacing:-.025em;line-height:1.38;margin:0 0 18px}
.nt p{font-family:"Noto Serif KR",serif;font-size:15px;line-height:1.9;color:var(--muted);
 margin:0 0 13px}
.nt p:last-of-type{margin-bottom:24px}
.nt p b{color:var(--ink);font-weight:600}
.nt-acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
.nt-acts button{font:inherit;font-size:13.5px;font-weight:600;padding:11px 17px;border-radius:2px;
 cursor:pointer;transition:border-color .2s ease,background-color .2s ease,color .2s ease}
.nt-later{border:1px solid var(--line);background:none;color:var(--muted)}
.nt-later:hover{border-color:var(--ink);color:var(--ink)}
.nt-close{border:1px solid var(--accent);background:var(--accent);color:#fff}
.nt-close:hover{background:var(--conflict);border-color:var(--conflict)}
@media(max-width:640px){
 .nt{right:16px;left:16px;top:auto;bottom:16px;width:auto;
  transform:translateY(18px);padding:24px 22px 20px}
 .nt.on{transform:translateY(0)}
 .nt h2{font-size:19px;margin-bottom:14px}
 .nt p{font-size:14px;line-height:1.85}
 .nt-acts button{flex:1}
}
@media (prefers-reduced-motion:reduce){
 .nt,.nt-veil{transition:none}
 .nt{transform:translateY(-50%)}
 @media(max-width:640px){.nt{transform:none}}
}
`;

/** 공지 창 마크업. <body> 안 아무 곳에 두면 됩니다. */
export const THEME_NOTICE =
  `<div class="nt-veil" id="ntVeil" hidden></div>` +
  `<aside class="nt" id="nt" role="dialog" aria-modal="false" aria-labelledby="ntTitle" hidden>` +
  `<p class="nt-kicker">공지</p>` +
  `<h2 id="ntTitle">감사맥락AI는 현재 업데이트 중입니다</h2>` +
  `<p>낯선 산업의 구조와 거래 흐름을 미리 이해하고, 감사 인터뷰의 질문과 요청 자료를 ` +
  `구체화하기 위해 만든 도구입니다.</p>` +
  `<p>현재는 초기 프로토타입이며, <b>8월 31일까지 대규모 업데이트</b>가 진행될 예정입니다. ` +
  `당초 안내드린 일정보다 늦어져 죄송합니다.</p>` +
  `<p>일부 미완성된 내용과 기능은 조금만 너그럽게 봐주세요.</p>` +
  `<div class="nt-acts">` +
  `<button type="button" class="nt-later" id="ntLater">오늘 하루 보지 않기</button>` +
  `<button type="button" class="nt-close" id="ntClose">닫기</button>` +
  `</div></aside>`;

/**
 * 공지 창 동작(태그 없음).
 *
 * 닫기 — 이번 방문에만 닫습니다. 새로 들어오면 다시 보입니다.
 * 오늘 하루 보지 않기 — 그날 자정까지 저장해 두고 띄우지 않습니다.
 * 저장을 못 하는 브라우저(사생활 보호 모드 등)에서는 그냥 매번 보입니다.
 */
export const THEME_NOTICE_SRC =
  `(function(){` +
  `var K="acai-notice-until",box=document.getElementById("nt"),veil=document.getElementById("ntVeil");` +
  `if(!box)return;` +
  `function until(){try{return Number(localStorage.getItem(K)||0);}catch(e){return 0;}}` +
  `if(Date.now()<until())return;` +
  /* rAF 는 화면을 그리지 않는 탭에서 안 돌 수 있습니다. 그러면 창이 투명한 채로
     남으므로, 프레임이 아니라 타이머로 등장 상태를 켭니다. */
  `function open(){box.hidden=false;veil.hidden=false;` +
  `setTimeout(function(){box.classList.add("on");veil.classList.add("on");},20);` +
  `document.getElementById("ntClose").focus({preventScroll:true});}` +
  `function shut(){box.classList.remove("on");veil.classList.remove("on");` +
  `setTimeout(function(){box.hidden=true;veil.hidden=true;},260);}` +
  `document.getElementById("ntClose").addEventListener("click",shut);` +
  `document.getElementById("ntLater").addEventListener("click",function(){` +
  `var d=new Date();d.setHours(24,0,0,0);` +
  `try{localStorage.setItem(K,String(d.getTime()));}catch(e){}shut();});` +
  `veil.addEventListener("click",shut);` +
  `addEventListener("keydown",function(e){if(e.key==="Escape"&&!box.hidden)shut();});` +
  `open();})();`;

/** 각 화면이 <style> 안에 넣는 한 덩어리. */
export const THEME_CSS = THEME_ROOT + THEME_BASE + THEME_TOPBAR_CSS + THEME_CURSOR_CSS;
