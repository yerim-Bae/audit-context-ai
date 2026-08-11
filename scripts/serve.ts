/**
 * dist/ 를 로컬에서 여는 아주 작은 정적 서버입니다. 외부 패키지를 쓰지 않습니다.
 * PDF 근거 링크(#page=N)가 브라우저에서 동작하도록, 파일을 직접 여는 대신 서버를 씁니다.
 *
 * 실행: npm start
 * 포트가 이미 쓰이고 있으면 다음 빈 포트를 찾아 씁니다.
 */

import { createServer } from "node:http";
import { connect } from "node:net";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

import { REPO_ROOT } from "../src/seed/load.ts";

const DIST = join(REPO_ROOT, "dist");
const FIRST_PORT = Number(process.env.PORT ?? 5173);
const MAX_TRIES = 12;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".pdf": "application/pdf",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

if (!existsSync(join(DIST, "index.html"))) {
  console.error("dist/index.html 이 없습니다. 먼저 `npm run build` 를 실행하세요.");
  process.exit(1);
}

const server = createServer((req, res) => {
  const rawPath = decodeURIComponent((req.url ?? "/").split("?")[0]!.split("#")[0]!);
  const rel = normalize(rawPath === "/" ? "/index.html" : rawPath).replace(/^([/\\])+/, "");
  const filePath = join(DIST, rel);

  if (!filePath.startsWith(DIST) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("찾을 수 없습니다: " + rel);
    return;
  }

  res.writeHead(200, {
    "content-type": MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream",
  });
  res.end(readFileSync(filePath));
});

/**
 * 그 포트에 이미 누가 응답하는지 미리 확인합니다.
 *
 * EADDRINUSE 만 믿으면 안 됩니다. 다른 앱이 ::1(IPv6 로컬호스트)에만 붙어 있으면
 * 우리가 ::(전체)로 바인딩해도 오류가 나지 않고 **둘 다 같은 포트에 붙습니다.**
 * 그러면 브라우저가 localhost 를 ::1 로 풀어 다른 앱을 열고, 우리 화면은 열리지 않습니다.
 * 실제로 그렇게 다른 프로젝트의 개발 서버가 5173 을 잡고 있었습니다.
 */
async function isPortTaken(port: number): Promise<boolean> {
  const probe = (host: string) =>
    new Promise<boolean>((resolve) => {
      const socket = connect({ host, port });
      const done = (taken: boolean) => {
        socket.destroy();
        resolve(taken);
      };
      socket.setTimeout(300);
      socket.once("connect", () => done(true));
      socket.once("timeout", () => done(false));
      socket.once("error", () => done(false));
    });

  const results = await Promise.all([probe("127.0.0.1"), probe("::1")]);
  return results.some(Boolean);
}

let attempt = 0;

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE" && attempt < MAX_TRIES) {
    attempt++;
    server.listen(FIRST_PORT + attempt);
    return;
  }
  if (err.code === "EADDRINUSE") {
    console.error(`${FIRST_PORT}번부터 ${MAX_TRIES}개 포트가 모두 사용 중입니다.`);
    console.error("다른 개발 서버를 끄거나 PORT 환경변수로 포트를 직접 지정하십시오.");
    process.exit(1);
  }
  console.error("서버를 열지 못했습니다:", err.message);
  process.exit(1);
});

server.on("listening", () => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : FIRST_PORT;
  const url = `http://localhost:${port}`;

  console.log("");
  console.log("  화면이 열렸습니다.  " + url);
  if (attempt > 0) {
    console.log(`  (${FIRST_PORT}번 포트를 다른 프로그램이 쓰고 있어 ${port}번으로 열었습니다.)`);
  }
  console.log("  브라우저가 자동으로 열리지 않으면 위 주소를 직접 입력하세요.");
  console.log("  종료하려면 이 창에서 Ctrl+C 를 누르세요.");
  console.log("");

  // PORT를 지정해 실행한 경우(자동화·미리보기 도구)에는 브라우저를 열지 않습니다.
  if (!process.env.PORT && process.env.NO_OPEN !== "1" && process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  }
});

/* 이미 누가 응답하는 포트는 건너뜁니다. 그 뒤에도 EADDRINUSE 는 그대로 대비합니다. */
let port = FIRST_PORT;
while (attempt < MAX_TRIES && (await isPortTaken(port))) {
  attempt++;
  port = FIRST_PORT + attempt;
}
server.listen(port);
