/**
 * DART OpenAPI 어댑터.
 *
 * 규칙(ADR 0007):
 *  - 사용자가 지정한 회사·공시만 한 건씩 가져옵니다. 목록을 훑는 자동 크롤링을 하지 않습니다.
 *  - 가져온 원문은 다른 출처와 똑같이 취급합니다: 불변 스냅샷, SHA-256, 위치 보존.
 *  - 이 파일은 원문을 가져오기만 합니다. 어떤 Claim도 만들지 않습니다.
 *
 * 인증키는 .env 의 DART_API_KEY 에서 읽습니다. 값을 로그에 남기지 않습니다.
 */

import { inflateRawSync } from "node:zlib";

const BASE = "https://opendart.fss.or.kr/api";

export class DartError extends Error {
  readonly status: string;

  constructor(status: string, message: string) {
    super(message);
    this.name = "DartError";
    this.status = status;
  }
}

/** DART가 돌려주는 상태 코드. 000 이 정상입니다. */
const STATUS_MESSAGE: Record<string, string> = {
  "000": "정상",
  "010": "등록되지 않은 키입니다.",
  "011": "사용할 수 없는 키입니다. 오픈API에 등록되었으나 일시적으로 사용이 중지된 키입니다.",
  "012": "접근할 수 없는 IP 입니다.",
  "013": "조회된 데이터가 없습니다.",
  "014": "파일이 존재하지 않습니다.",
  "020": "요청 제한을 초과했습니다.",
  "021": "조회 가능한 회사 개수가 초과했습니다.",
  "100": "필드의 부적절한 값입니다.",
  "101": "부적절한 접근입니다.",
  "800": "시스템 점검으로 인한 서비스가 중지 중입니다.",
  "900": "정의되지 않은 오류가 발생했습니다.",
  "901": "사용자 계정의 개인정보보호 요청에 따른 오류입니다.",
};

export function describeStatus(status: string): string {
  return STATUS_MESSAGE[status] ?? `알 수 없는 상태 코드 ${status}`;
}

export function readApiKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = (env.DART_API_KEY ?? "").trim();
  if (!key) {
    throw new Error("DART_API_KEY 가 비어 있습니다. .env 파일에 인증키를 넣으세요.");
  }
  if (!/^[0-9a-f]{40}$/i.test(key)) {
    throw new Error("DART_API_KEY 형식이 올바르지 않습니다. 40자리 16진수 키여야 합니다.");
  }
  return key;
}

/** 키를 노출하지 않고 로그에 남길 수 있는 형태로 가립니다. */
export function maskKey(key: string): string {
  return key.slice(0, 4) + "…" + key.slice(-4);
}

function url(path: string, key: string, params: Record<string, string> = {}): string {
  const u = new URL(`${BASE}/${path}`);
  u.searchParams.set("crtfc_key", key);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

/** 오류 메시지에 인증키가 섞여 나가지 않도록 지웁니다. */
function scrub(text: string, key: string): string {
  return text.split(key).join("[KEY]");
}

async function getJson(path: string, key: string, params: Record<string, string>): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url(path, key, params));
  } catch (e) {
    throw new Error(`DART에 연결하지 못했습니다: ${scrub(String(e), key)}`);
  }
  if (!res.ok) {
    throw new Error(`DART 응답 오류 HTTP ${res.status}`);
  }
  const body = (await res.json()) as { status: string; message?: string };
  if (body.status !== "000") {
    throw new DartError(body.status, describeStatus(body.status));
  }
  return body;
}

async function getBytes(path: string, key: string, params: Record<string, string>): Promise<Buffer> {
  const res = await fetch(url(path, key, params));
  if (!res.ok) throw new Error(`DART 응답 오류 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  // 오류일 때는 ZIP 대신 XML/JSON 로 상태 코드가 옵니다.
  const head = buf.subarray(0, 4).toString("latin1");
  if (!head.startsWith("PK")) {
    const text = buf.toString("utf-8");
    const status = /<status>(\d+)<\/status>/.exec(text)?.[1] ?? /"status"\s*:\s*"(\d+)"/.exec(text)?.[1];
    throw new DartError(status ?? "900", describeStatus(status ?? "900"));
  }
  return buf;
}

/** 연결과 인증키가 유효한지만 확인합니다. 데이터를 저장하지 않습니다. */
export async function checkConnection(key: string): Promise<{ ok: true }> {
  try {
    await getJson("list.json", key, {
      bgn_de: "20250102",
      end_de: "20250103",
      page_count: "1",
    });
  } catch (e) {
    // 013(조회된 데이터 없음)은 키가 유효하다는 뜻이므로 통과로 봅니다.
    if (e instanceof DartError && e.status === "013") return { ok: true };
    throw e;
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* ZIP 읽기 — DART는 회사코드와 공시 원문을 ZIP으로 내려줍니다.        */
/* ------------------------------------------------------------------ */

export interface ZipEntry {
  name: string;
  data: Buffer;
}

/** 중앙 디렉터리를 읽어 각 항목을 풀어냅니다. stored(0)와 deflate(8)만 지원합니다. */
export function unzip(buf: Buffer): ZipEntry[] {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("ZIP 형식이 아닙니다 (EOCD 없음).");

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("ZIP 중앙 디렉터리가 손상되었습니다.");
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf-8");

    if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("ZIP 지역 헤더가 손상되었습니다.");
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compressedSize);

    entries.push({ name, data: method === 0 ? Buffer.from(raw) : inflateRawSync(raw) });
    p += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

/* ------------------------------------------------------------------ */
/* 회사 검색                                                            */
/* ------------------------------------------------------------------ */

export interface Company {
  corpCode: string;
  corpName: string;
  stockCode: string;
  modifyDate: string;
}

/** 전체 회사 코드 파일(ZIP)을 받습니다. 용량이 커서 한 번 받아 캐시해 두고 씁니다. */
export async function fetchCorpCodeXml(key: string): Promise<string> {
  const zip = await getBytes("corpCode.xml", key, {});
  const entry = unzip(zip).find((e) => e.name.toLowerCase().endsWith(".xml"));
  if (!entry) throw new Error("회사코드 ZIP 안에 XML이 없습니다.");
  return entry.data.toString("utf-8");
}

/** 회사코드 XML에서 이름으로 회사를 찾습니다. 상장사(고유번호에 종목코드가 있는 회사)를 앞에 둡니다. */
export function searchCompanies(xml: string, name: string, limit = 20): Company[] {
  const needle = name.replace(/\s+/g, "");
  const out: Company[] = [];

  for (const m of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
    const block = m[1]!;
    const pick = (tag: string) => (new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(block)?.[1] ?? "").trim();
    const corpName = pick("corp_name");
    if (!corpName.replace(/\s+/g, "").includes(needle)) continue;
    out.push({
      corpCode: pick("corp_code"),
      corpName,
      stockCode: pick("stock_code"),
      modifyDate: pick("modify_date"),
    });
  }

  out.sort((a, b) => {
    const listed = Number(Boolean(b.stockCode)) - Number(Boolean(a.stockCode));
    if (listed !== 0) return listed;
    return a.corpName.length - b.corpName.length;
  });
  return out.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* 공시 목록과 원문                                                     */
/* ------------------------------------------------------------------ */

export interface Filing {
  corpName: string;
  reportName: string;
  receiptNo: string;
  filerName: string;
  receiptDate: string;
}

/** 지정한 회사의 공시 목록을 가져옵니다. pblntfTy 'A' 는 정기공시입니다. */
export async function listFilings(
  key: string,
  corpCode: string,
  opts: { bgnDe: string; endDe: string; pblntfTy?: string; pageCount?: number } = {
    bgnDe: "20200101",
    endDe: "20261231",
  },
): Promise<Filing[]> {
  const body = await getJson("list.json", key, {
    corp_code: corpCode,
    bgn_de: opts.bgnDe,
    end_de: opts.endDe,
    pblntf_ty: opts.pblntfTy ?? "A",
    page_count: String(opts.pageCount ?? 100),
  });
  return (body.list ?? []).map((r: any) => ({
    corpName: r.corp_name,
    reportName: String(r.report_nm ?? "").trim(),
    receiptNo: r.rcept_no,
    filerName: r.flr_nm,
    receiptDate: r.rcept_dt,
  }));
}

/** 공시 원문(ZIP 안의 XML)을 가져옵니다. 반환값은 파일 이름과 원본 바이트입니다. */
export async function fetchDocument(key: string, receiptNo: string): Promise<ZipEntry[]> {
  const zip = await getBytes("document.xml", key, { rcept_no: receiptNo });
  return unzip(zip);
}

/** DART 공시 원문은 대개 EUC-KR 입니다. 선언을 보고 알맞게 디코딩합니다. */
export function decodeDocument(data: Buffer): string {
  const head = data.subarray(0, 200).toString("latin1").toLowerCase();
  const encoding = /encoding\s*=\s*["']([^"']+)["']/.exec(head)?.[1] ?? "utf-8";
  const normalized = /euc-?kr|ks_c_5601/i.test(encoding) ? "euc-kr" : "utf-8";
  return new TextDecoder(normalized).decode(data);
}
