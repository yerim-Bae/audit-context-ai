# Audit Context AI — Claude Code Instructions

## Mission

Build an evidence-first audit preparation tool that explains a company's transaction structure and connects it to accounts, audit risks, requested documents, and interview questions.

The product is not a generic DART summarizer and not an autonomous auditor. It helps a human auditor understand and verify.

## MVP boundary

- Domain: travel agencies
- Transaction: airline ticket sales settled through BSP
- Accounting focus: unsettled balances and restricted/pledged deposits
- Primary output: transaction map plus evidence-backed audit preparation pack
- Use a fictional company unless company-specific claims are supported by company-specific sources.

Do not add other industries, automatic DART ingestion, broad web crawling, multi-tenant permissions, or autonomous accounting conclusions unless the user explicitly changes scope.

## Non-negotiable domain rules

1. Every material declarative statement is a `Claim`.
2. Every `FACT` claim must have at least one directly supporting `EvidenceSpan`.
3. Keep these dimensions separate:
   - assertion status: `FACT | INFERENCE | UNVERIFIED | CONFLICTING`
   - review status: `AI_EXTRACTED | HUMAN_VERIFIED | REJECTED | STALE`
   - scope: `INDUSTRY | COMPANY | PERIOD | TRANSACTION`
   - source trust grade: `S | A | B | C | D`
4. A source about an industry cannot prove a company-specific claim.
5. A D-grade source cannot be the sole support for a FACT.
6. Confidence does not change an inference into a fact.
7. Preserve source snapshots, hashes, versions, page/section locators, and short supporting excerpts.
8. Never silently fill missing facts. Create an `UNVERIFIED` claim and convert it into a requested document or interview question.
9. Conflicting evidence must remain visible until a human resolves it.
10. The system assists audit planning; it must not present an audit opinion or final accounting conclusion.

## Architecture

Use a modular monolith for the web product and a separate asynchronous document worker.

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

Dependencies flow inward:

```text
UI/API -> application use cases -> domain
worker -> application use cases -> domain
infrastructure implements domain ports
```

The domain package must not import Next.js, database clients, model SDKs, or UI code.

## Preferred stack

- TypeScript and Next.js App Router for web/API
- PostgreSQL and Drizzle ORM
- PostgreSQL full-text search; pgvector only where semantic retrieval is evaluated
- Python worker for PDF/layout parsing
- S3-compatible immutable source storage
- Zod or JSON Schema validation for every model-produced structure
- Vitest, Testing Library, Playwright, and pytest

Pin stable dependency versions in lockfiles. Do not introduce Redis, Kafka, a graph database, or a separate search service without an ADR and measured need.

## Source and claim workflow

The required pipeline is:

```text
register source
-> save immutable snapshot
-> parse with reproducible locators
-> identify evidence spans
-> extract atomic claim candidates
-> validate schema, quotation, and scope
-> human review
-> map to transaction/account/risk/request/question
-> compose output from claims
```

Never generate a final answer directly from raw retrieved chunks.

## Coding rules

- Prefer small, explicit domain types over generic JSON blobs.
- Use enums or discriminated unions for statuses.
- Make ingestion jobs idempotent using source hash and pipeline version.
- Store timestamps in UTC and display them in the user's locale.
- Validate all external inputs at the boundary.
- Return typed expected errors; reserve exceptions for unexpected failures.
- Keep model prompts versioned under `packages/ai/prompts`.
- Store model, prompt version, input references, output references, latency, and errors for every generation run.
- Do not log full confidential documents or secrets.
- No source text may be overwritten; create a new snapshot.
- Schema changes require migrations. Do not edit production-shaped data manually.
- Add an ADR under `docs/decisions` for changes to service boundaries, storage, trust rules, or model workflow.

## UI rules

- Always show assertion status near a claim.
- An evidence citation must open the exact source location.
- Show industry-general and company-specific claims differently.
- Do not use color as the only status signal.
- Keep unverified and conflicting items visible.
- Every risk, request item, and interview question must expose its rationale chain.
- Default screen for a case is the transaction map, not chat.

## Testing gates

Every feature must preserve these invariants:

- 100% of FACT claims have direct evidence.
- No important unsupported declarative claim is rendered.
- Numeric and date claims match the cited source exactly.
- Industry evidence cannot promote a company claim to FACT.
- Replacing a source snapshot marks dependent claims for stale review.
- A citation resolves to the stored snapshot and locator.
- Failed or retried jobs do not create duplicate claims.

For AI behavior, add or update an evaluation fixture. Do not rely only on unit tests with mocked model output.

## Working method

Before coding:

1. Read this file, `docs/source-policy.md`, the relevant ADRs, and the nearest tests.
2. Restate the requested outcome and identify affected invariants.
3. Inspect existing code before proposing new abstractions.

While coding:

1. Make the smallest end-to-end change that proves the behavior.
2. Keep domain rules out of route handlers and React components.
3. Add tests with the implementation.
4. Avoid unrelated refactors.

Before finishing:

1. Run formatting, type checks, unit tests, trust evaluations, and the relevant browser test.
2. Review the diff for accidental secrets, unsupported claims, and scope expansion.
3. Report what changed, what was verified, and any remaining uncertainty.

## Initial delivery order

1. Domain enums and Claim/Evidence models
2. PostgreSQL schema and migrations
3. Curated BSP seed manifest and 20 golden claims
4. Source snapshot and evidence viewer
5. Claim review queue
6. Read-only BSP transaction map
7. Account/risk/request/question mappings
8. Structured extraction pipeline
9. Evidence-grounded question flow
10. Audit preparation export

## Commands

Keep this section current as scripts are added. Do not claim a check passed unless it was actually run.

### Available now

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

```bash
python scripts/extract_pdf_pages.py   # only when a source PDF changes
```

### Not available yet

`lint`, `test:e2e`, `eval`, `db:migrate`, `db:seed` do not exist.

- There is no browser e2e runner. Screen tests assert on the generated HTML string; interaction is verified by a human in the browser. Do not report markup assertions as e2e.
- There is no linter beyond Prettier formatting.
- Database commands are intentionally absent — see `docs/decisions/0001-defer-database.md`.
- Package manager is npm, not pnpm — see `docs/decisions/0005-npm-and-node-builtin-tooling.md`.
- The web app is a static render, not Next.js — see `docs/decisions/0006-static-render-instead-of-nextjs.md`.

## Definition of done for the first vertical slice

A user can open the fictional BSP demo case, inspect a curated IATA source, view atomic claims with exact evidence, distinguish facts from inferences and unknowns, follow the BSP transaction flow, and trace one restricted-deposit risk through its requested documents and interview questions. Trust regression tests pass.

