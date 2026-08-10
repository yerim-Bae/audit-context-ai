/**
 * 온보딩 카드덱 화면. 팩 하나를 단일 HTML 문자열로 만듭니다.
 *
 * 화면에 나오는 문장은 전부 이 파일과 팩 데이터 안에 미리 들어갑니다.
 * 브라우저 JS는 보이기/숨기기, 읽은 카드 표시, 로컬 키워드 검색만 합니다
 * (docs/decisions/0006-static-render-instead-of-nextjs.md).
 * 그래서 브라우저 없이도 화면 규칙을 문자열로 검사할 수 있습니다 — tests/pack-integrity.test.ts
 *
 * 실행: node scripts/build-deck.ts
 */

import {
  CARD_AXIS_LABEL_KO,
  TRACK_HIDDEN_IN_TOC,
  TRACK_LABEL_KO,
  TRACK_ORDER,
  totalMinutes,
} from "../domain/pack.ts";
import type { Card, Pack } from "../domain/pack.ts";

/** 화면에 나가는 모든 사용자 문자열은 이 함수를 거칩니다. 카드 본문(검증된 HTML 조각)만 예외입니다. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * <script> 안에 넣을 JSON.
 * `<` 를 전부 < 로 바꾸므로 `</script>` 로 태그가 일찍 닫히지 않고, `<!--` 도 생기지 않습니다.
 * JSON.parse 가 < 를 다시 `<` 로 되돌리므로 데이터는 그대로입니다.
 * U+2028·U+2029 는 JSON 에서는 유효하지만 자바스크립트 소스에서는 줄바꿈이라 함께 막습니다.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** 태그를 벗긴 본문. 검색 색인에만 씁니다. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CSS = `
:root{
 --bg:#faf9f7; --panel:#fff; --ink:#1f2328; --muted:#6b7280; --line:#e6e3de;
 --accent:#2f5d50; --accent-soft:#eaf1ee; --warn:#8a5a2b; --warn-soft:#fdf3e7;
 --chip:#f3f1ed; --shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.05);
}
@media(prefers-color-scheme:dark){:root{
 --bg:#16181c; --panel:#1e2126; --ink:#e8e6e3; --muted:#9aa0a6; --line:#2e3238;
 --accent:#7fb3a2; --accent-soft:#20302b; --warn:#d9a45b; --warn-soft:#2c2419;
 --chip:#262a30; --shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.25);}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
 font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Malgun Gothic",sans-serif;
 line-height:1.75;font-size:16px;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px 80px}
header{border-bottom:1px solid var(--line);background:var(--panel);position:sticky;top:0;z-index:10}
.hdr{max-width:1080px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.brand{font-weight:700;font-size:15px;letter-spacing:-.02em}
.brand span{color:var(--muted);font-weight:400}
.hdr .sp{flex:1}
.meta{font-size:13px;color:var(--muted)}
.btn{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:8px;
 padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit}
.btn:hover{background:var(--chip)}
.layout{display:grid;grid-template-columns:236px 1fr;gap:32px;margin-top:28px}
@media(max-width:860px){.layout{grid-template-columns:1fr}.side{order:2}}
.side h4{font-size:12px;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;margin:18px 0 8px}
.toc{list-style:none;margin:0;padding:0}
.toc li{margin:1px 0}
.toc button{width:100%;text-align:left;border:0;background:none;color:var(--ink);cursor:pointer;
 padding:5px 8px;border-radius:6px;font-size:13.5px;font-family:inherit;line-height:1.45}
.toc button:hover{background:var(--chip)}
.toc button.on{background:var(--accent-soft);color:var(--accent);font-weight:600}
.toc button.done::after{content:" · 읽음";color:var(--accent);font-size:11px}
.toc button.on.done::after{content:""}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:32px 34px;box-shadow:var(--shadow)}
@media(max-width:860px){.card{padding:24px 20px}}
.kicker{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.tag{font-size:11.5px;padding:3px 9px;border-radius:999px;background:var(--chip);color:var(--muted);letter-spacing:.01em}
.tag .mark{font-weight:700;margin-right:4px}
.tag.axis-INDUSTRY{background:var(--accent-soft);color:var(--accent)}
.tag.axis-MIXED{background:var(--warn-soft);color:var(--warn)}
.tag.axis-UNVERIFIED{background:var(--warn-soft);color:var(--warn)}
h1{font-size:25px;line-height:1.35;margin:.1em 0 .35em;letter-spacing:-.02em}
.lead{color:var(--muted);font-size:15.5px;margin:0 0 22px}
.body p{margin:0 0 15px}
.body ul,.body ol{margin:0 0 15px;padding-left:20px}
.body li{margin:5px 0}
.body b{font-weight:650}
.body table{width:100%;border-collapse:collapse;margin:18px 0;font-size:14.5px}
.body th,.body td{border-bottom:1px solid var(--line);padding:9px 10px;text-align:left;vertical-align:top}
.body th{color:var(--muted);font-weight:600;font-size:13px;letter-spacing:.02em}
.body blockquote{margin:16px 0;padding:12px 16px;background:var(--warn-soft);border-left:3px solid var(--warn);border-radius:0 8px 8px 0}
.body blockquote p:last-child{margin:0}
.body em{font-style:normal;background:var(--warn-soft);color:var(--warn);padding:1px 5px;border-radius:4px;font-size:14px}
.audit{margin:24px 0 0;padding:16px 18px;background:var(--accent-soft);border-radius:10px;font-size:15px}
.audit b{color:var(--accent);display:block;font-size:12px;letter-spacing:.05em;margin-bottom:5px}
.terms{margin-top:22px;border-top:1px solid var(--line);padding-top:16px}
.terms .t{display:flex;gap:10px;font-size:14px;margin:6px 0}
.terms .t b{min-width:88px;color:var(--accent);font-weight:600}
.terms .t span{color:var(--muted)}
.nextwrap{margin-top:26px}
.nextwrap h4{font-size:12px;letter-spacing:.06em;color:var(--muted);margin:0 0 10px}
.chips{display:flex;flex-direction:column;gap:8px}
.chip{text-align:left;border:1px solid var(--line);background:var(--panel);color:var(--ink);
 border-radius:10px;padding:12px 15px;cursor:pointer;font-size:15px;font-family:inherit;
 transition:.12s;display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%}
.chip:hover{border-color:var(--accent);background:var(--accent-soft)}
.chip .arw{color:var(--muted);font-size:13px;flex-shrink:0}
.ask{margin-top:26px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px 22px}
.askrow{display:flex;gap:8px}
.askrow input{flex:1;border:1px solid var(--line);background:var(--bg);color:var(--ink);
 border-radius:9px;padding:11px 14px;font-size:15px;font-family:inherit}
.askrow input:focus{outline:2px solid var(--accent-soft);border-color:var(--accent)}
.hits{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.hits .chip{font-size:14.5px;padding:10px 14px}
.note{font-size:12.5px;color:var(--muted);margin-top:10px;line-height:1.6}
.ovlnote{max-width:1100px;margin:16px auto 0;padding:12px 16px;border:1px solid var(--line);
 border-radius:10px;background:var(--accent-soft);font-size:13.5px;line-height:1.7}
.ovlnote a{color:var(--accent);font-weight:600}
/* display 를 정하지 않습니다. .hide 보다 뒤에 오는 규칙이라 display 를 쓰면 숨기기를 덮습니다. */
a.btn{text-decoration:none;line-height:1.6}
.start{max-width:640px;margin:56px auto;background:var(--panel);border:1px solid var(--line);
 border-radius:16px;padding:40px 38px;box-shadow:var(--shadow)}
.start h2{font-size:22px;margin:0 0 6px;letter-spacing:-.02em}
.start .sub{color:var(--muted);font-size:15px;margin:0 0 28px}
.f{margin-bottom:20px}
.f label{display:block;font-size:13px;color:var(--muted);margin-bottom:7px;letter-spacing:.02em}
.f input{width:100%;border:1px solid var(--line);background:var(--bg);color:var(--ink);
 border-radius:9px;padding:11px 14px;font-size:15px;font-family:inherit}
.opts{display:flex;gap:8px;flex-wrap:wrap}
.opt{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;
 padding:8px 15px;font-size:14px;cursor:pointer;font-family:inherit}
.opt.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.opt.on::before{content:"\\2713 ";font-weight:700}
.go{width:100%;margin-top:12px;background:var(--accent);color:#fff;border:0;border-radius:10px;
 padding:13px;font-size:15.5px;font-weight:600;cursor:pointer;font-family:inherit}
.go:disabled{opacity:.4;cursor:default}
.prog{font-size:12.5px;color:var(--muted)}
footer{max-width:1080px;margin:40px auto 0;padding:20px;border-top:1px solid var(--line);
 font-size:12.5px;color:var(--muted);line-height:1.7}
.legend{display:inline-flex;gap:6px;align-items:center;margin-right:10px}
footer ul{margin:8px 0 0;padding-left:18px}
footer li{margin:3px 0}
.hide{display:none}
`;

/**
 * 브라우저 스크립트. 카드 마크업은 이미 HTML 안에 있으므로 여기서는 만들지 않습니다.
 * 검색 결과만 DOM API 로 만들되 textContent 만 써서, 런타임에 HTML 을 조립하지 않습니다.
 */
const CLIENT_JS = `
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("deck-data").textContent);
  var OVERLAYS = DATA.overlays || [];
  var INDEX = {};
  DATA.cards.forEach(function (c) { INDEX[c.id] = c; });

  var S = { company: "", position: "", field: "", fieldId: "", fieldCard: "", current: "", seen: [], minutes: 0 };

  function el(id) { return document.getElementById(id); }
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  /* ---------- 시작 화면: 세 값이 다 있어야 시작 ---------- */
  function checkReady() {
    S.company = el("co").value.trim();
    el("go").disabled = !(S.company && S.position && S.field);
  }
  el("co").addEventListener("input", checkReady);

  all("#pos .opt").forEach(function (b) {
    b.onclick = function () {
      all("#pos .opt").forEach(function (x) { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
      b.classList.add("on");
      b.setAttribute("aria-pressed", "true");
      S.position = b.getAttribute("data-label");
      all("#posnotes .note").forEach(function (n) {
        n.classList.toggle("hide", n.getAttribute("data-pos") !== b.getAttribute("data-id"));
      });
      checkReady();
    };
  });

  all("#fld .opt").forEach(function (b) {
    b.onclick = function () {
      all("#fld .opt").forEach(function (x) { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
      b.classList.add("on");
      b.setAttribute("aria-pressed", "true");
      S.field = b.getAttribute("data-label");
      S.fieldId = b.getAttribute("data-id");
      S.fieldCard = b.getAttribute("data-card");
      checkReady();
    };
  });

  /* 회사 층이 준비된 회사인지 본다. 이름이 정확히 같을 때만 잇는다 — 짐작으로 잇지 않는다. */
  function overlayFor(name) {
    var key = String(name || "").replace(/\\s+/g, "");
    for (var i = 0; i < OVERLAYS.length; i++) {
      if (OVERLAYS[i].companyName.replace(/\\s+/g, "") === key) return OVERLAYS[i];
    }
    return null;
  }

  el("go").onclick = function () {
    el("startview").classList.add("hide");
    el("mainview").classList.remove("hide");
    el("ctx").textContent = S.company + " \\u00b7 " + S.position + " \\u00b7 " + S.field;

    var ov = overlayFor(S.company);
    var link = el("ovl");
    if (link) {
      if (ov) {
        link.setAttribute("href", ov.href);
        link.textContent = "이 회사 차이표 \\u2192";
        link.classList.remove("hide");
      } else {
        link.classList.add("hide");
      }
    }
    var banner = el("ovlnote");
    if (banner) {
      banner.classList.toggle("hide", !ov);
      if (ov) {
        banner.innerHTML =
          "<b>" + ov.companyName + "</b> \\u00b7 회사 층이 준비되어 있습니다. " +
          "산업 카드를 읽은 뒤 <a href=\\"" + ov.href + "\\">차이표</a>로 넘어가면 " +
          "이 회사 공시가 실제로 무엇을 말하는지 볼 수 있습니다.";
      }
    }

    var shown = {};
    all("#myfield .fieldrow").forEach(function (row) {
      var mine = row.getAttribute("data-field") === S.fieldId || row.getAttribute("data-field") === "";
      var cardId = row.getAttribute("data-card");
      if (mine && !shown[cardId]) { shown[cardId] = 1; row.classList.remove("hide"); }
    });
    all(".fieldjump").forEach(function (chip) {
      chip.classList.toggle("hide", chip.getAttribute("data-field") !== S.fieldId);
    });

    openCard(DATA.entryCardId);
  };

  el("reset").onclick = function () { location.reload(); };

  /* ---------- 카드 이동 ---------- */
  function openCard(id) {
    var card = el("card-" + id);
    if (!card) return;
    if (S.seen.indexOf(id) === -1) {
      S.seen.push(id);
      S.minutes += INDEX[id] ? INDEX[id].minutes : 0;
    }
    S.current = id;
    all("#cardhost .card").forEach(function (c) { c.classList.toggle("hide", c !== card); });
    all(".tocbtn").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-id") === id);
      b.classList.toggle("done", S.seen.indexOf(b.getAttribute("data-id")) !== -1);
    });
    el("prog").textContent = S.seen.length + "/" + DATA.cards.length + "\\uc7a5 \\u00b7 \\uc57d " + S.minutes + "\\ubd84";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* 목차·질문 칩·검색 결과가 모두 같은 규칙으로 움직이므로 클릭은 한 곳에서 받습니다. */
  document.addEventListener("click", function (e) {
    var start = e.target && e.target.closest ? e.target : e.target && e.target.parentElement;
    var button = start && start.closest ? start.closest("[data-to], .tocbtn") : null;
    if (!button) return;
    var to = button.getAttribute("data-to") || button.getAttribute("data-id");
    if (to) { e.preventDefault(); openCard(to); }
  });

  /* ---------- 로컬 키워드 검색 ---------- */
  function search(text) {
    var host = el("hits");
    var empty = el("nohit");
    host.textContent = "";
    var query = (text || "").trim();
    empty.classList.add("hide");
    if (!query) return;

    var tokens = query.replace(/[?!.,]/g, " ").split(/\\s+/).filter(function (t) { return t.length > 1; });
    if (!tokens.length) return;

    var hits = DATA.cards
      .map(function (c) {
        var score = 0;
        tokens.forEach(function (t) {
          if (c.title.indexOf(t) !== -1) score += 6;
          if (c.terms.some(function (x) { return x.indexOf(t) !== -1; })) score += 5;
          score += Math.min(c.hay.split(t).length - 1, 4);
        });
        return { card: c, score: score };
      })
      .filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 4);

    if (!hits.length) { empty.classList.remove("hide"); return; }

    hits.forEach(function (hit) {
      var button = document.createElement("button");
      button.className = "chip";
      button.setAttribute("data-to", hit.card.id);
      var title = document.createElement("span");
      title.textContent = hit.card.title;
      var minutes = document.createElement("span");
      minutes.className = "arw";
      minutes.textContent = hit.card.minutes + "\\ubd84";
      button.appendChild(title);
      button.appendChild(minutes);
      host.appendChild(button);
    });
  }

  el("qb").onclick = function () { search(el("q").value); };
  el("q").addEventListener("keydown", function (e) { if (e.key === "Enter") search(el("q").value); });
})();
`;

function renderAxisTag(card: Card): string {
  const axis = CARD_AXIS_LABEL_KO[card.axis];
  return (
    `<span class="tag axis-${card.axis}" title="${escapeHtml(axis.hint)}">` +
    `<span class="mark" aria-hidden="true">${escapeHtml(axis.mark)}</span>${escapeHtml(axis.label)}</span>`
  );
}

function renderCard(pack: Pack, card: Card, byId: Map<string, Card>): string {
  const next = card.next.filter((n) => byId.has(n.to));
  const showFieldJump = card.track !== "FIELD" && card.track !== "WRAP_UP";

  const terms = card.terms.length
    ? `<div class="terms">` +
      card.terms
        .map(
          (t) => `<div class="t"><b>${escapeHtml(t.term)}</b><span>${escapeHtml(t.definition)}</span></div>`,
        )
        .join("") +
      `</div>`
    : "";

  const chips = next
    .map((link) => {
      const target = byId.get(link.to)!;
      return (
        `<button class="chip" type="button" data-to="${escapeHtml(link.to)}">` +
        `<span>${escapeHtml(link.question)}</span>` +
        `<span class="arw">${target.minutes}분</span></button>`
      );
    })
    .join("");

  /* 담당 필드로 가는 칩은 필드마다 미리 만들어 두고, 시작 화면에서 고른 것만 보입니다. */
  const fieldJumps = showFieldJump
    ? pack.fieldMatrix.fields
        .filter((f) => byId.has(f.card))
        .map((f) => {
          const target = byId.get(f.card)!;
          return (
            `<button class="chip fieldjump hide" type="button" data-field="${escapeHtml(f.id)}" data-to="${escapeHtml(f.card)}">` +
            `<span>제 필드(${escapeHtml(f.label)})에서 볼 것으로 바로 갈게요</span>` +
            `<span class="arw">${target.minutes}분</span></button>`
          );
        })
        .join("")
    : "";

  /* 본문은 로더가 허용 태그·무속성을 확인한 HTML 조각입니다(src/pack/load.ts). */
  return (
    `<article class="card hide" id="card-${escapeHtml(card.id)}">` +
    `<div class="kicker">` +
    `<span class="tag">${escapeHtml(TRACK_LABEL_KO[card.track])}</span>` +
    renderAxisTag(card) +
    `<span class="tag">${card.minutes}분</span>` +
    `</div>` +
    `<h1>${escapeHtml(card.title)}</h1>` +
    `<p class="lead">${escapeHtml(card.lead)}</p>` +
    `<div class="body">${card.body}</div>` +
    `<div class="audit"><b>이걸 알면 무엇이 달라지나</b>${escapeHtml(card.audit)}</div>` +
    terms +
    `<div class="nextwrap"><h4>이어서 볼 것</h4><div class="chips">${chips}${fieldJumps}</div></div>` +
    `</article>`
  );
}

function renderToc(pack: Pack, byId: Map<string, Card>): string {
  const sections: string[] = [];

  for (const track of TRACK_ORDER) {
    if (TRACK_HIDDEN_IN_TOC.includes(track)) continue;
    const cards = pack.cards.filter((c) => c.track === track);
    if (!cards.length) continue;
    sections.push(
      `<h4>${escapeHtml(TRACK_LABEL_KO[track])}</h4><ul class="toc">` +
        cards
          .map(
            (c) =>
              `<li><button class="tocbtn" type="button" data-id="${escapeHtml(c.id)}">${escapeHtml(c.title)}</button></li>`,
          )
          .join("") +
        `</ul>`,
    );
  }

  /* "내 필드"는 담당 필드를 고른 뒤에 그 줄만 보입니다. data-field 가 빈 값이면 항상 보이는 줄입니다. */
  const rows: string[] = [];
  for (const field of pack.fieldMatrix.fields) {
    const card = byId.get(field.card);
    if (!card) continue;
    rows.push(
      `<li class="fieldrow hide" data-field="${escapeHtml(field.id)}" data-card="${escapeHtml(card.id)}">` +
        `<button class="tocbtn" type="button" data-id="${escapeHtml(card.id)}">${escapeHtml(card.title)}</button></li>`,
    );
  }
  for (const cardId of pack.fieldMatrix.alwaysCards) {
    const card = byId.get(cardId);
    if (!card) continue;
    rows.push(
      `<li class="fieldrow hide" data-field="" data-card="${escapeHtml(card.id)}">` +
        `<button class="tocbtn" type="button" data-id="${escapeHtml(card.id)}">${escapeHtml(card.title)}</button></li>`,
    );
  }

  return (
    `<div class="side"><h4>목차</h4><div id="toc">${sections.join("")}</div>` +
    `<h4>내 필드</h4><ul class="toc" id="myfield">${rows.join("")}</ul></div>`
  );
}

function renderStart(pack: Pack, overlays: OverlayLink[]): string {
  const positions = pack.fieldMatrix.positions
    .map(
      (p) =>
        `<button class="opt" type="button" aria-pressed="false" data-id="${escapeHtml(p.id)}" data-label="${escapeHtml(p.label)}">${escapeHtml(p.label)}</button>`,
    )
    .join("");

  const positionNotes = pack.fieldMatrix.positions
    .filter((p) => p.note)
    .map((p) => `<p class="note hide" data-pos="${escapeHtml(p.id)}">${escapeHtml(p.note)}</p>`)
    .join("");

  const fields = pack.fieldMatrix.fields
    .map(
      (f) =>
        `<button class="opt" type="button" aria-pressed="false" data-id="${escapeHtml(f.id)}" data-label="${escapeHtml(f.label)}" data-card="${escapeHtml(f.card)}">${escapeHtml(f.label)}</button>`,
    )
    .join("");

  return (
    `<div id="startview"><div class="start">` +
    `<h2>어느 회사를 맡으셨나요</h2>` +
    `<p class="sub">${escapeHtml(pack.meta.subtitle)}</p>` +
    `<div class="f"><label for="co">회사명</label>` +
    `<input id="co" type="text" placeholder="예: 한국조선" list="colist" autocomplete="off">` +
    (overlays.length
      ? `<datalist id="colist">` +
        overlays.map((o) => `<option value="${escapeHtml(o.companyName)}">`).join("") +
        `</datalist>` +
        `<p class="note">회사 층이 준비된 회사: ` +
        overlays
          .map(
            (o) =>
              `<a href="${escapeHtml(o.href)}">${escapeHtml(o.companyName)}</a>(${escapeHtml(o.positionLabel)})`,
          )
          .join(", ") +
        `. 그 밖의 회사는 산업 카드만 열립니다.</p>`
      : "") +
    `</div>` +
    `<div class="f"><label>밸류체인 위치 — 이게 없으면 무엇을 볼지 정해지지 않습니다</label>` +
    `<div class="opts" id="pos">${positions}</div><div id="posnotes">${positionNotes}</div></div>` +
    `<div class="f"><label>담당 필드</label><div class="opts" id="fld">${fields}</div></div>` +
    `<button class="go" type="button" id="go" disabled>시작하기</button>` +
    `<p class="note">${escapeHtml(pack.fieldMatrix.note)}</p>` +
    `</div></div>`
  );
}

/** 출처와 시점 한계는 화면 아래에 항상 붙어 있습니다. 접거나 숨기지 않습니다. */
function renderFooter(pack: Pack): string {
  const legend = (["INDUSTRY", "MIXED", "UNVERIFIED"] as const)
    .map((axis) => {
      const label = CARD_AXIS_LABEL_KO[axis];
      return (
        `<span class="legend"><span class="tag axis-${axis}">` +
        `<span class="mark" aria-hidden="true">${escapeHtml(label.mark)}</span>${escapeHtml(label.label)}</span>` +
        `${escapeHtml(label.hint)}</span>`
      );
    })
    .join("<br>");

  /* 이 팩으로 답할 수 없는 것도 함께 보여 줍니다. 빈칸을 조용히 채우지 않기 위해서입니다. */
  const limits = pack.meta.source.limits.length
    ? `<b>이 팩으로 답할 수 없는 것</b><ul>` +
      pack.meta.source.limits.map((limit) => `<li>${escapeHtml(limit)}</li>`).join("") +
      `</ul>`
    : "";

  return (
    `<footer><b>정보 출처와 한계</b><br>` +
    `이 팩은 ${escapeHtml(pack.meta.source.basis)}` +
    (pack.meta.source.collectedRange ? `(${escapeHtml(pack.meta.source.collectedRange)})` : "") +
    `. ${escapeHtml(pack.meta.source.limitation)} ` +
    `${escapeHtml(pack.meta.source.asOf)}<br>` +
    `${legend}<br>` +
    `${escapeHtml(pack.meta.searchNote)}` +
    limits +
    `</footer>`
  );
}

/** 팩 하나를 화면 하나로. 순수 함수입니다. */
/** 이 팩에 회사 층이 준비된 회사. 카드덱에서 차이표로 넘어가는 링크가 됩니다(ADR 0011). */
export interface OverlayLink {
  id: string;
  companyName: string;
  positionLabel: string;
  href: string;
}

export interface DeckRenderOptions {
  overlays?: OverlayLink[];
}

export function renderDeckPage(pack: Pack, options: DeckRenderOptions = {}): string {
  const byId = new Map(pack.cards.map((c) => [c.id, c]));
  const overlays = options.overlays ?? [];

  /* 검색 색인. 본문 HTML 대신 태그를 벗긴 글자만 넣습니다. */
  const data = {
    packId: pack.meta.id,
    entryCardId: pack.meta.entryCardId,
    overlays,
    cards: pack.cards.map((c) => ({
      id: c.id,
      title: c.title,
      minutes: c.minutes,
      terms: c.terms.map((t) => t.term + " " + t.definition),
      hay: [
        c.title,
        c.lead,
        c.terms.map((t) => t.term + " " + t.definition).join(" "),
        plainText(c.body),
        c.next.map((n) => n.question).join(" "),
      ].join(" "),
    })),
  };

  const title = `${pack.meta.title} — ${pack.meta.industry}`;

  return (
    `<!DOCTYPE html>\n<html lang="ko"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(title)}</title>\n<style>${CSS}</style></head><body>\n` +
    `<header><div class="hdr">` +
    `<div class="brand">${escapeHtml(pack.meta.title)} <span>· ${escapeHtml(pack.meta.industry)}</span></div>` +
    `<div class="sp"></div><div class="meta" id="ctx"></div>` +
    `<div class="prog" id="prog">0/${pack.cards.length}장 · 약 0분</div>` +
    `<a class="btn hide" id="ovl" href="">이 회사 차이표 →</a>` +
    `<button class="btn" type="button" id="reset">처음부터</button>` +
    `</div></header>\n` +
    renderStart(pack, overlays) +
    `\n<div class="wrap hide" id="mainview">` +
    `<p class="ovlnote hide" id="ovlnote"></p>` +
    `<div class="layout">` +
    renderToc(pack, byId) +
    `<div><div id="cardhost">` +
    pack.cards.map((c) => renderCard(pack, c, byId)).join("\n") +
    `</div>` +
    `<div class="ask"><div class="askrow">` +
    `<label class="hide" for="q">궁금한 것 찾기</label>` +
    `<input id="q" type="text" placeholder="궁금한 걸 적어보세요 — 예: 대금은 언제 받나요, 후판이 뭐죠">` +
    `<button class="btn" type="button" id="qb">찾기</button></div>` +
    `<div class="hits" id="hits"></div>` +
    `<p class="note hide" id="nohit">이 팩에는 없는 내용입니다. 회사 자료(사업보고서 주석·핵심감사사항)나 담당자 인터뷰로 확인할 항목일 수 있습니다.</p>` +
    `<p class="note">카드 ${pack.cards.length}장 · 전부 읽으면 약 ${totalMinutes(pack.cards)}분. ${escapeHtml(pack.meta.searchNote)}</p>` +
    `</div></div>` +
    `</div></div>\n` +
    renderFooter(pack) +
    `\n<script type="application/json" id="deck-data">${jsonForScript(data)}</script>\n` +
    `<script>${CLIENT_JS}</script>\n</body></html>\n`
  );
}

/** 팩이 여러 개일 때 여는 목록 화면. */
export function renderDeckIndexPage(packs: Pack[]): string {
  const rows = packs
    .map(
      (p) =>
        `<li><a href="deck-${escapeHtml(p.meta.id)}.html">${escapeHtml(p.meta.title)} — ${escapeHtml(p.meta.industry)}</a>` +
        ` <span class="meta">카드 ${p.cards.length}장 · 약 ${totalMinutes(p.cards)}분</span></li>`,
    )
    .join("");

  return (
    `<!DOCTYPE html>\n<html lang="ko"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>감사 투입 전 온보딩 — 팩 목록</title>\n<style>${CSS}` +
    `ul.packs{list-style:none;padding:0;margin:24px 0}ul.packs li{margin:10px 0;font-size:16px}` +
    `ul.packs a{color:var(--accent)}ul.packs .meta{margin-left:8px}` +
    `</style></head><body>\n` +
    `<header><div class="hdr"><div class="brand">감사 투입 전 온보딩 <span>· 팩 목록</span></div></div></header>\n` +
    `<div class="wrap"><div class="start"><h2>어느 산업을 보시겠습니까</h2>` +
    `<ul class="packs">${rows}</ul>` +
    `<p class="note">각 팩은 산업 일반론입니다. 감사 판단의 근거가 아니라 합리성 검증의 기준선으로만 쓰십시오.</p>` +
    `</div></div>\n</body></html>\n`
  );
}
