/**
 * 배포하는 화면 묶음 검사 (W1~W5).
 *
 * 화면이 여럿이 되면서 서로를 링크로 잇습니다. 링크 하나가 끊기면 사람이 길을 잃는데
 * 그건 단위 검사로 안 잡힙니다. 여기서는 **만들어진 dist/ 를 실제로 읽어** 확인합니다.
 *
 * dist/ 가 없으면 건너뜁니다 — `npm run build` 를 돌린 뒤에 의미가 있는 검사입니다.
 *
 * 실행: node --test "tests/*.test.ts"
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "../src/pack/load.ts";

const DIST = join(REPO_ROOT, "dist");
const built = existsSync(join(DIST, "index.html"));

/** 화면끼리 잇는 링크만 봅니다. 바깥 주소(DART 등)와 앵커는 대상이 아닙니다. */
function internalLinks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const href = m[1]!;
    if (/^(https?:|mailto:|#|data:)/.test(href)) continue;
    out.push(href.split("#")[0]!.split("?")[0]!);
  }
  return out.filter((h) => h.length > 0);
}

test("W1 dist/ 가 만들어져 있다", { skip: built ? false : "npm run build 를 먼저 실행하세요" }, () => {
  assert.ok(existsSync(join(DIST, "index.html")));
});

if (built) {
  const pages = readdirSync(DIST).filter((f) => f.endsWith(".html"));

  test("W2 첫 화면이 산업 드롭다운과 시작 버튼을 가진다", () => {
    const home = readFileSync(join(DIST, "index.html"), "utf-8");
    assert.ok(home.includes('id="ind"'), "산업 드롭다운이 없습니다.");
    assert.ok(home.includes('id="go"'), "시작 버튼이 없습니다.");
    assert.ok(/<option value="[^"]+"/.test(home), "고를 수 있는 산업이 하나도 없습니다.");
  });

  test("W3 화면끼리 잇는 링크가 전부 실제 파일을 가리킨다", () => {
    const missing: string[] = [];
    for (const page of pages) {
      const html = readFileSync(join(DIST, page), "utf-8");
      for (const link of internalLinks(html)) {
        if (!existsSync(join(DIST, link))) missing.push(`${page} → ${link}`);
      }
    }
    assert.deepEqual(missing, [], `끊긴 링크:\n  ${missing.join("\n  ")}`);
  });

  test("W4 첫 화면에서 모든 산업 화면에 닿는다", () => {
    const home = readFileSync(join(DIST, "index.html"), "utf-8");
    const decks = pages.filter((p) => p.startsWith("deck-"));
    for (const deck of decks) {
      assert.ok(home.includes(deck), `첫 화면에서 ${deck} 로 가는 길이 없습니다.`);
    }
    assert.ok(home.includes("travel-bsp.html"), "첫 화면에 여행업 거래 지도가 없습니다.");
  });

  test("W5 배포본에 DART 인증키가 들어가지 않는다", () => {
    /* .env 는 커밋되지 않지만, 있으면 그 값이 실제로 새지 않았는지까지 확인합니다. */
    const envPath = join(REPO_ROOT, ".env");
    const key = existsSync(envPath)
      ? /^\s*DART_API_KEY\s*=\s*(.+)$/m.exec(readFileSync(envPath, "utf-8"))?.[1]?.trim()
      : undefined;

    for (const file of readdirSync(DIST)) {
      const path = join(DIST, file);
      if (!file.endsWith(".html") && !file.endsWith(".json")) continue;
      const text = readFileSync(path, "utf-8");
      assert.ok(!text.includes("DART_API_KEY"), `${file} 에 인증키 이름이 있습니다.`);
      assert.ok(!/crtfc_key=/.test(text), `${file} 에 인증키 파라미터가 있습니다.`);
      if (key && key.length >= 20) {
        assert.ok(!text.includes(key), `${file} 에 인증키 값이 그대로 들어 있습니다.`);
      }
    }
  });
}
