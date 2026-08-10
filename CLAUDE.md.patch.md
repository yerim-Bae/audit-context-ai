# CLAUDE.md 수정 제안 — 산업팩과 온보딩 카드덱

- 날짜: 2026-08-10
- 근거: [ADR 0009](docs/decisions/0009-add-industry-packs-and-onboarding-deck.md), [ADR 0010](docs/decisions/0010-lecture-source-grade-and-limits.md), [docs/onboarding-deck-design.md](docs/onboarding-deck-design.md)
- 상태: 제안 — 두 ADR이 승인된 뒤에 반영합니다

전체 파일을 다시 쓰지 않습니다. 아래 다섯 절만 바뀝니다. `CLAUDE.md`의 본문은 영어이므로 변경안도 영어로 적었습니다.

---

## 수정 1 — "MVP boundary" 절

### 현재

```markdown
## MVP boundary

- Domain: travel agencies
- Transaction: airline ticket sales settled through BSP
- Accounting focus: unsettled balances and restricted/pledged deposits
- Primary output: transaction map plus evidence-backed audit preparation pack
- Use a fictional company unless company-specific claims are supported by company-specific sources.

Do not add other industries, automatic DART ingestion, broad web crawling, multi-tenant permissions, or autonomous accounting conclusions unless the user explicitly changes scope.
```

### 변경안

```markdown
## MVP boundary

### Audit linkage — travel agencies only

- Domain: travel agencies
- Transaction: airline ticket sales settled through BSP
- Accounting focus: unsettled balances and restricted/pledged deposits
- Primary output: transaction map plus evidence-backed audit preparation pack
- Use a fictional company unless company-specific claims are supported by company-specific sources.

Transaction maps, audit risks, request items, and interview questions stay inside this boundary. Do not build them for other industries.

### Scope changes already approved

- Company search and the business-model dashboard cover all listed companies — `docs/decisions/0008-allow-all-listed-companies.md`
- DART filings may be ingested one document at a time — `docs/decisions/0007-allow-dart-ingestion.md`
- Industry learning packs and the onboarding card deck cover other industries — `docs/decisions/0009-add-industry-packs-and-onboarding-deck.md`

A pack is a learning surface, not an evidence asset. Every pack statement is `INDUSTRY` scope and can never be `FACT` — `docs/decisions/0010-lecture-source-grade-and-limits.md`. Never mix `packs/` content into `seed/`.

Do not add broad web crawling, multi-tenant permissions, or autonomous accounting conclusions unless the user explicitly changes scope.
```

### 이유

현재 문장은 "Do not add other industries"를 조건 없이 금지합니다. ADR 0008이 이미 그 절반을 풀었는데도 이 절은 그대로여서, 읽는 사람이 규칙과 실제 저장소 상태를 대조할 방법이 없습니다. **무엇이 여전히 여행업 한정이고(감사 연결) 무엇이 풀렸는지(학습 표면·회사 검색)를 갈라 적어야** 다음 사람이 선을 넘지 않습니다.

---

## 수정 2 — "Non-negotiable domain rules" 절

### 현재

```markdown
4. A source about an industry cannot prove a company-specific claim.
5. A D-grade source cannot be the sole support for a FACT.
```

### 변경안

```markdown
4. A source about an industry cannot prove a company-specific claim.
5. A D-grade source cannot be the sole support for a FACT. The same limit applies to any single-publisher, unedited source regardless of its grade letter — see `docs/decisions/0010-lecture-source-grade-and-limits.md`.
11. Content under `packs/` is `INDUSTRY` scope and never `FACT`. Repetition by the same speaker is not cross-verification.
```

### 이유

규칙 5는 등급 글자에만 걸려 있습니다. 산업 강의는 `C`로 배정되므로 문자 그대로는 규칙 5를 비켜 가지만, 규칙이 막으려는 상태(검증 절차가 없는 자료 하나로 사실을 세우는 것)에는 정확히 해당합니다. **규칙의 취지를 문장으로 적어 두지 않으면 다음 팩에서 반드시 새어 나갑니다.**

규칙 11을 새로 추가하는 이유는 ADR 0004의 불변식(`COMPANY`는 `FACT` 불가)이 이 파일에는 없고 `docs/source-policy.md` §7에만 있어 놓치기 쉬웠기 때문입니다. 팩 불변식은 처음부터 여기에 둡니다.

---

## 수정 3 — "Architecture" 절의 디렉터리 목록

### 현재

```text
apps/web        Next.js UI and thin HTTP endpoints
apps/worker     document parsing and extraction jobs
packages/db     schema, migrations, repositories
packages/domain pure business rules and use cases
packages/ai     provider adapters, prompts, schemas, evaluations
packages/ui     reusable UI components
seed            curated BSP demo data
evals           trust and retrieval regression sets
docs            product, architecture, ADRs, source policy
```

### 변경안

```text
apps/web        Next.js UI and thin HTTP endpoints
apps/worker     document parsing and extraction jobs
packages/db     schema, migrations, repositories
packages/domain pure business rules and use cases
packages/ai     provider adapters, prompts, schemas, evaluations
packages/ui     reusable UI components
seed            curated BSP demo data — claims with evidence
packs           industry learning packs — cards, not evidence (ADR 0009)
evals           trust and retrieval regression sets
docs            product, architecture, ADRs, source policy
```

바로 아래에 다음 문단을 추가합니다.

```markdown
`seed/` and `packs/` are separate trust domains. A pack card is never evidence for a seed claim, and a seed claim is never copied into a card. They have separate loaders, separate tests, and separate build commands.

A pack directory holds `pack.json` (industry, sources, date range), `sources/` (lossless notes of the original material), `knowledge/` (reference library), and `cards.json` (the deck).
```

### 이유

디렉터리를 나눈 것이 이 변경의 핵심 장치입니다. 목록에 `packs`만 한 줄 넣으면 "또 하나의 데이터 폴더"로 읽히고, 다음 사람이 팩 문장을 근거로 Claim을 만들 것입니다. **왜 나눴는지를 목록 바로 아래에 적어야 규칙으로 작동합니다.**

---

## 수정 4 — "Testing gates" 절

### 현재

```markdown
Every feature must preserve these invariants:

- 100% of FACT claims have direct evidence.
- No important unsupported declarative claim is rendered.
- Numeric and date claims match the cited source exactly.
- Industry evidence cannot promote a company claim to FACT.
- Replacing a source snapshot marks dependent claims for stale review.
- A citation resolves to the stored snapshot and locator.
- Failed or retried jobs do not create duplicate claims.
```

### 변경안

```markdown
Every feature must preserve these invariants:

- 100% of FACT claims have direct evidence.
- No important unsupported declarative claim is rendered.
- Numeric and date claims match the cited source exactly.
- Industry evidence cannot promote a company claim to FACT.
- Replacing a source snapshot marks dependent claims for stale review.
- A citation resolves to the stored snapshot and locator.
- Failed or retried jobs do not create duplicate claims.

Card deck invariants (`packs/`, checks D1–D11 in `docs/onboarding-deck-design.md` §9):

- No card carries `assertion_status = FACT`.
- Every card body stays within 800–1,400 characters, holds at most one table, and states what changes if you know this.
- Every card exposes a scope/status badge, and every deck page exposes the source-and-date notice.
- Every "next question" target resolves to an existing card.
- Numbers in a card carry their source date.
```

### 이유

카드 무결성 검사는 신뢰성 검사와 **다른 것을 지킵니다.** 신뢰성 검사는 근거의 존재를, 카드 검사는 근거가 없다는 사실이 화면에서 사라지지 않는 것을 지킵니다. 두 묶음을 섞어 적으면 어느 쪽이 실패했는지 보고가 흐려집니다.

검사 이름을 `D`로 시작하는 이유는 `seed/`의 `T` 번호와 섞이지 않게 하기 위해서입니다.

---

## 수정 5 — "Commands" 절

### 현재

```bash
npm install            # dev tooling only: typescript, prettier, @types/node
npm start              # build + serve the transaction map at http://localhost:5173
npm run build          # generate dist/index.html and copy source PDFs
npm test               # 36 checks: seed trust (20) + rendered screen (16)
npm run typecheck      # tsc --noEmit
npm run format:check   # prettier --check
npm run seed:report    # human-readable dump of the golden dataset
npm run review         # review tables as markdown
```

### 변경안

```bash
npm install            # dev tooling only: typescript, prettier, @types/node
npm start              # build + serve the transaction map at http://localhost:5173
npm run build          # generate dist/index.html and copy source PDFs
npm run deck:build     # generate dist/deck/<industry>.html from packs/<industry>/cards.json
npm test               # seed trust + rendered screen + ingestion + company case + card deck
npm run typecheck      # tsc --noEmit
npm run format:check   # prettier --check
npm run seed:report    # human-readable dump of the golden dataset
npm run review         # review tables as markdown
```

`deck:build`가 하는 일을 "Not available yet" 위에 한 줄로 덧붙입니다.

```markdown
`deck:build` reads a pack's `cards.json` and writes one static HTML file per industry. No runtime dependencies, no model calls at build time — cards are authored and reviewed by a human before they ship (ADR 0006, ADR 0009).
```

### 이유

이 절의 첫 문장이 "Do not claim a check passed unless it was actually run"입니다. 따라서 **`deck:build` 줄은 `package.json`에 스크립트가 실제로 들어간 커밋에서만 추가합니다.** 그 전까지는 "Not available yet"에 둡니다.

`npm test`의 설명에서 "36 checks: seed trust (20) + rendered screen (16)"의 숫자를 뺀 이유는, 검사가 추가될 때마다 이 줄이 낡기 때문입니다. `README.md`는 이미 53건으로 적고 있어 **두 문서가 지금 서로 다릅니다.** 숫자 대신 묶음 이름만 적으면 이 불일치가 다시 생기지 않습니다.

---

## 반영 순서

1. ADR 0009와 0010을 승인합니다. 승인 전에는 `CLAUDE.md`를 고치지 않습니다.
2. 수정 1·2·3을 먼저 반영합니다. 이 셋은 규칙이므로 코드보다 앞섭니다.
3. 카드 무결성 검사 D1~D11을 만들고 조선업 팩을 통과시킵니다. 현재 팩은 최소 네 건이 걸립니다(`docs/onboarding-deck-design.md` §9).
4. `deck:build`를 구현한 뒤 수정 4·5를 반영합니다.

## 이 패치에서 다루지 않은 것

- `docs/source-policy.md` §2 — "개인 채널의 전문가 해설 영상"의 등급 경계를 한 줄 추가해야 합니다(ADR 0010).
- `docs/glossary.md` — 팩 용어는 여기에 넣지 않기로 했으므로 변경이 없습니다. 다만 그 방침을 §1 머리말에 한 줄로 적어 두면 다음 사람이 묻지 않습니다.
- `docs/stage-mapping.md` — 카드덱이 어느 단계에 붙는지 정하지 않았습니다. `시작하기.md` 6단계의 선택지에 넣을지 사용자가 결정해야 합니다.
- `README.md` — 폴더 구조와 "아직 없는 것"에 팩을 반영해야 하지만, 화면이 실제로 만들어진 뒤에 씁니다.
