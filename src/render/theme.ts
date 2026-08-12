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

/** 글꼴 파일. 포트폴리오와 같은 두 벌을 씁니다. */
export const THEME_FONTS =
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

/** 각 화면이 <style> 안에 넣는 한 덩어리. */
export const THEME_CSS = THEME_ROOT + THEME_BASE + THEME_TOPBAR_CSS + THEME_CURSOR_CSS;
