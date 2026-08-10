# 인수인계 — 산업팩과 온보딩 카드덱

작성 2026-08-10 · 대상: 이 저장소를 Claude Code로 이어받는 세션
읽는 순서: 이 문서 → `CLAUDE.md.patch.md` → `docs/decisions/0009` → `docs/decisions/0010` → `docs/onboarding-deck-design.md`

---

## 1. 결론 — 새로 만들지 말고 이 저장소를 확장한다

새 저장소를 팔지 검토했고, **기존 `audit-context-ai`를 확장하는 쪽으로 결정**했다. 근거는 기존 도메인 모델이 새로 만들려던 것과 사실상 동일하기 때문이다.

| 새로 설계했던 개념 | 이 저장소에 이미 있는 것 |
|---|---|
| 축 3분류(산업일반 / 회사확인 / 미확인) | `Scope`(INDUSTRY·COMPANY·PERIOD·TRANSACTION) + `AssertionStatus`(FACT·INFERENCE·UNVERIFIED·CONFLICTING) |
| 산업 일반론을 회사 사실로 자동 승격 금지 | 도메인 규칙 4 "A source about an industry cannot prove a company-specific claim" |
| 빈칸 → 자료요청·질문으로 전환 | 도메인 규칙 8 "Never silently fill missing facts…" |
| 5칸 연결 사슬(구조→계정→위험→자료→질문) | `transaction-steps` / `risks` / `request-items` / `interview-questions` |
| 출처 등급 A·B·C | `TrustGrade` S·A·B·C·D + `docs/source-policy.md` |
| 정적 HTML 배포 | ADR 0006 static-render-instead-of-nextjs |

**새 저장소를 팠다면 이 규칙들을 다시 만들고 두 곳에서 서로 다르게 관리하게 된다.** 다만 두 자산은 성격이 달라 섞으면 안 되므로 디렉터리를 분리했다 — 자세한 것은 ADR 0009.

- `seed/` — 근거 원문이 붙은 Claim 자산. 여행업 BSP·하나투어. 신뢰 규칙이 엄격하다.
- `packs/` — 2차자료 기반 **학습 표면**. 카드덱의 재료. FACT를 만들지 않는다.

---

## 2. 들어오는 것

```
HANDOFF.md                                    이 문서
CLAUDE.md.patch.md                            CLAUDE.md 수정 제안 (전체 교체 아님, 절 단위 패치)
docs/decisions/0009-…                         산업팩·카드덱 도입 (범위 변경 ADR)
docs/decisions/0010-…                         강의 출처 등급과 사용 한계 ADR
docs/onboarding-deck-design.md                카드덱 설계 (저장소 용어로 번역됨)
docs/pack-authoring.md                        산업팩 1종 만드는 절차서
prompts/pack/01-source-note.md                원문 → 무손실 소스노트
prompts/pack/02-merge-pack.md                 소스노트 N개 → 통합 마스터
prompts/pack/03-cards.md                      마스터 → 카드 26장  ★핵심
prompts/pack/04-field-matrix.md               개념 × 위치 × 필드 필요도 판정
src/domain/pack.ts                            Card·Pack 타입, 축→Scope/AssertionStatus 매핑
src/pack/load.ts                              팩 로드 + 무결성 검증
src/render/deckPage.ts                        카드덱 렌더러 (순수 함수)
scripts/build-deck.ts                         packs/* → dist/deck-<id>.html
tests/pack-integrity.test.ts                  카드 무결성 18항목
packs/README.md                               10개 산업 현황표와 우선순위
packs/_template/                              새 산업 시작용 빈 템플릿 3종
packs/shipbuilding/pack.json                  조선업 팩 메타
packs/shipbuilding/cards.json                 카드 26장
packs/shipbuilding/knowledge/                 카드 근거가 된 마스터 8문서 (약 600KB)
```

## 3. 지금 상태 — 검증된 것과 안 된 것

**실제로 돌려서 확인한 것** (Node 22.22, 기존 저장소와 병합한 사본에서)

```
node scripts/build-deck.ts            → dist/deck-shipbuilding.html 131.9 KB, 카드 26장
node --test "tests/*.test.ts"         → 18/18 통과
tsc --noEmit (신규 파일 대상)          → 0건
prettier --check                       → 통과
브라우저(Chromium) 실제 렌더            → pageerror 0, 시작 화면·카드 이동·검색 동작
```

**확인 안 된 것**

- 실제 브라우저 e2e 러너 없음. 상호작용은 사람이 한 번 열어봐야 한다 (다크모드·스크롤·폰트)
- `.prettierrc.json`을 못 읽어 printWidth 110을 역산했다. 실제 설정과 대조할 것
- 전체 `tsc --noEmit`은 기존 파일 임포트 문제로 TS2307이 4건 난다 (신규 파일과 무관)

---

## 4. 첫 세션에서 할 일 — 순서대로

### 4-0. 먼저 git

**이 저장소는 아직 git 저장소가 아니다.** `.gitignore`는 있는데 `.git`이 없다.

```bash
git init
git add -A && git commit -m "chore: 기존 상태 스냅샷"   # 산업팩 얹기 전 원본 보존
git switch -c feat/industry-packs
```

> ⚠ **경로가 OneDrive 안이다** (`OneDrive\Desktop\감사맥락AI`). OneDrive는 `.git/` 내부 파일을 동기화하다 인덱스를 깨뜨리는 사고가 잦다. **OneDrive 바깥으로 옮기고 작업하는 것을 권한다** (예: `C:\Users\yelim\dev\audit-context-ai`). 옮기지 않겠다면 최소한 OneDrive 설정에서 이 폴더를 동기화 제외하라.
>
> `.gitignore` 확인: `node_modules/`, `.env`, `dist/sources/`(대용량 원문 PDF·XML 6MB)가 들어 있는지. `seed/hanatour/sources/`에 5MB짜리 XML이 있으므로 커밋 전에 확인할 것.

### 4-1. 파일 배치와 CLAUDE.md 갱신

새 파일은 그대로 복사하면 된다. **기존 파일은 하나도 덮어쓰지 않는다.** `CLAUDE.md`만 `CLAUDE.md.patch.md`의 제안을 검토해 반영한다 — 전체 교체가 아니라 절 단위 수정이다.

`package.json`에 추가:
```json
"build:deck": "node scripts/build-deck.ts",
```
`format`/`format:check` 글롭에 `"packs/**/*.json"`을 넣으려면 **`npm run format`을 먼저 한 번 돌려라.** 지금 `packs/` JSON은 prettier 미적용 상태라 바로 넣으면 `format:check`가 깨진다.

### 4-2. 규격 정합화 (첫 커밋에서 끝낼 것)

조선업 카드가 자기 규격을 세 군데 어긴다. 검사는 이미 `tests/pack-integrity.test.ts`에 있으니 **검사를 먼저 조이고 팩을 고치는 순서**로 간다.

| 위반 | 현재 | 규격 | 조치 |
|---|---|---|---|
| C15 표 행 수 | 8행 | 6행 이하 | 표를 쪼개거나 행 합치기 |
| C06 본문 | 796자 | 800자 이상 | 한 문장 보강 |
| C01·C04 다음 질문 | 5개 | 3~4개 | 하나 빼거나 규격을 3~5로 완화 (택일해 문서에 반영) |
| C26 표 | 2개 | 1개 | 하나를 목록으로 |

`axis` 값 혼재(`산업일반` 3장)는 이미 `산업`으로 정규화했다.

### 4-3. `field-matrix.json` 만들기

조선업에 아직 없다. **카드가 매트릭스보다 먼저 만들어져 파이프라인 순서(P4 → P3)와 반대로 갔다.** `prompts/pack/04-field-matrix.md`로 조선업 매트릭스를 만들고, 이미 나온 카드 26장과 역방향 대조해서 빠진 개념·과잉 개념을 찾아라. 이게 파이프라인이 실제로 작동하는지 검증하는 첫 시험이다.

로더는 파일이 없어도 `pack.json`의 `positions`/`fields`로 동작하게 되어 있다. 생기면 그쪽을 우선 쓴다.

### 4-4. 사람이 한 번 열어보기

`dist/deck-shipbuilding.html`을 브라우저로 열어 다크모드·모바일 폭·긴 표 스크롤을 확인한다. 이건 자동 검사가 못 잡는다.

---

## 5. 커밋 분할 제안

한 덩어리로 올리지 말고 나눠라. ADR이 코드보다 먼저 들어가야 리뷰가 된다.

```
1. docs: ADR 0009·0010과 카드덱 설계 추가
2. docs: CLAUDE.md 범위 갱신 (산업팩 도입)
3. feat: 팩 도메인 타입과 로더
4. feat: 카드덱 렌더러와 빌드 스크립트
5. test: 팩 무결성 검사 18항목
6. feat: 조선업 팩 (카드 26장 + 근거 문서)
7. docs: 산업팩 제작 프롬프트 4종과 절차서
8. fix: 조선업 카드 규격 정합화
```

---

## 6. 알려진 문제 — 넘기기 전에 알고 있어야 할 것

1. **ADR 0009·0010이 기존 ADR보다 길다.** 기존 0001~0008은 643~1,644자인데 새 둘은 2,468자·3,416자다. 필수 논점을 줄이면 규칙 충돌 해소가 빠지므로 그대로 뒀다. 줄일지 판단 필요.
2. **`docs/source-policy.md`에 "실명 전문가의 자가 발행 영상"의 등급 정의가 없다.** C로 배정하되 D와 같은 사용 제한을 걸었다(ADR 0010). source-policy §2에 한 줄 추가가 필요하다.
3. **`CLAUDE.md`와 `README.md`가 이미 불일치한다** — 테스트 수를 CLAUDE.md는 36건, README는 53건으로 적고 있다. 패치안은 숫자를 빼고 묶음 이름만 남기도록 제안했다.
4. **INFERENCE 정의 문제.** `claim-lifecycle.md`의 INFERENCE는 전제가 "확인된 사실"이어야 하는데, 팩의 전제는 UNVERIFIED다. 기존 `seed/` 검사는 건드리지 않고 팩 전용 검사를 따로 뒀다. 미해결로 남아 있다 — 설계문서 §11 참조.
5. **소스노트 원본 8편(612KB)이 이 저장소에 없다.** `packs/shipbuilding/knowledge/`에는 통합 마스터만 있다. 원본은 옵시디언 볼트 `97. 감사맥락 AI DB/조선업/소스노트/`에 있다. 저장소에 넣을지 결정 필요 — 넣으면 근거 추적이 되지만 용량이 는다.
6. **ADR 상태가 전부 `제안됨`이다.** 승인 후 문구를 바꿔야 한다.

---

## 7. 다음 9개 산업

원자료(염승환 「함께 배우기」 자동자막)는 확보되어 있다: 반도체, 이차전지, 원전, 헬스케어, 우주항공, AI, 피지컬AI, 자율주행, 풍력.

절차는 `docs/pack-authoring.md`, 우선순위와 근거는 `packs/README.md`에 있다. 요약하면 **반도체 → 이차전지 → 원전** 순이되, **파이프라인을 검증할 목적이라면 원전을 먼저 돌려라** — 수주·마일스톤·진행률·계약변경 골격이 조선업과 거의 같아 제작 비용이 가장 낮고, 프롬프트가 산업을 갈아끼워도 작동하는지 가장 빨리 알 수 있다.

한 산업당 대략: P1 8회(편당 1) → P4 1회 → P2 1회(섹션별 분할) → P3 1회. 조선업 실측은 원자 1,684개, 소스노트 612KB, 카드 26장이었다.

**해운업은 9종 밖에 있다.** 카드덱의 밸류체인 위치에 `해운사`가 선택지로 있는데 해운업 팩이 없어 지금은 안내만 뜬다. 조선사 감사와 짝이 되는 자리라 언젠가 필요하다.

---

## 8. 하지 말 것

- `seed/`와 `packs/`를 섞지 마라. 신뢰 규칙이 다르다.
- 카드에서 **회사 사실을 단정하지 마라.** 카드에 등장하는 실명 기업은 산업 구조의 예시일 뿐이다. 감사대상 회사에 대한 서술은 전부 UNVERIFIED다.
- 교차확인됐다고 FACT로 올리지 마라. 8편이 **같은 화자**라서 독립 출처가 아니다.
- 자막 훼손 구간을 추측으로 채우지 마라. 원문 보존이 원칙이다.
- 실제 회사명·실제 감사자료를 저장소에 넣지 마라 (README 경고).
- 돌리지 않은 검사를 통과했다고 보고하지 마라 (CLAUDE.md 규칙).
