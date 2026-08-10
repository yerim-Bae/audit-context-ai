/**
 * DART 인증키와 연결 상태만 확인합니다. 아무것도 저장하지 않습니다.
 * 인증키 값은 출력하지 않습니다.
 *
 * 실행: npm run dart:check
 */

import { checkConnection, DartError, maskKey, readApiKey } from "../src/ingest/dart.ts";

try {
  const key = readApiKey();
  console.log(`인증키 확인: ${maskKey(key)} (40자리 형식 정상)`);
  await checkConnection(key);
  console.log("DART 연결 성공. 인증키가 유효합니다.");
} catch (e) {
  if (e instanceof DartError) {
    console.error(`DART 오류 [${e.status}] ${e.message}`);
  } else {
    console.error(String(e instanceof Error ? e.message : e));
  }
  process.exitCode = 1;
}
