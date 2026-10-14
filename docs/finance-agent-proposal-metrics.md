# 금융 Multi-Agent PoC — 제안용 지표 (측정 결과)

**문서 상태**: 테스트 스위트에서 **실제로 실행·통과한 결과**만 기록합니다. 프로덕션 API 키·실 트래픽 기반 수치는 **아직 없음** (해당 항목은 명시적으로 구분).

**최종 갱신**: 2026-10-12  
**측정 환경**: 로컬 `npm run test:finance`, `TEST_TYPE=integration npm run test:finance:integration`, `npx tsx tests/finance/finance-ui.e2e.ts` (DynamoDB Local, Mock LLM/OpenDART)

---

## 1. 요약 (제안용 한 줄)

| 영역 | 측정 근거 | 결과 (요약) |
|------|-----------|-------------|
| 비용 가드레일 | `shared/finance/cost/config.ts` + 통합 테스트 | Run당 상한 **$0.50**, 기본 일일 예산 **$5.00** (환경변수로 변경 가능) |
| 데모 정확도 | `demo-scenario.integration.test.ts` (7단계, Mock) | 공시 분석·가설 저장·URL 무결성·메모리 복원 **전부 통과** |
| UI 출처 표시 | `finance-ui.e2e.ts` | 출처 카드 ≥2, 날짜 정밀도 배지 표시 검증 |
| 복원력 | `worker.integration.test.ts` 등 | 강제 종료 복구 4건, 중복 Run 방지, DLQ 3건, reconciliation 3건 — **통합 82/82 통과** |

---

## 2. 비용 (Cost)

### 2.1 정책 상한 (코드 기본값, 실측 아님)

`getCostConfig()` 기본값 (`shared/finance/cost/config.ts`):

| 항목 | 값 | 비고 |
|------|-----|------|
| Run당 최대 비용 (`maxCostUsd`) | **0.5 USD** | `FINANCE_RUN_MAX_COST_USD`로 재정의 가능 |
| Run당 최대 스텝 | 6 | |
| Run당 최대 LLM 호출 | 20 | |
| Run당 최대 시간 | 50,000 ms | |
| 일일 예산 (`dailyBudgetUsd`) | **5.0 USD** | `FINANCE_DAILY_BUDGET_USD`로 재정의 가능 (통합 테스트 예시: 10.0) |

**미측정**: OpenRouter/실제 모델 단가로 집계한 프로덕션 일별 사용량.

### 2.2 Mock Run에서 측정된 토큰·비용 (통합 테스트 로그)

`TEST_TYPE=integration` + `tests/finance/demo-scenario.integration.test.ts` 실행 시 콘솔 출력 (2026-10-12 로컬 1회):

| 시나리오 | steps | calls | cost (USD) | wall time |
|----------|-------|-------|------------|-----------|
| Mock LLM 공시 검색·분석 (Step 2) | **2** | **2** | **0.000375** | 113 ms |

- 비용 계산: `calculateActualCost` + 허용 모델 가격표 (Mock LLM이 반환한 input/output 토큰 기반).
- **Mock 기반**이며, 실 API 호출 비용이 아님.

### 2.3 UI E2E 시드 Run (스크린샷용 Mock 데이터)

`finance-ui.e2e.ts`에 삽입하는 완료 Run 예시 (`run-completed`):

| 필드 | 값 |
|------|-----|
| inputTokens | 15,420 |
| outputTokens | 2,840 |
| costUsd | **0.0287** |
| steps | 5 |
| calls | 12 |

**Mock DynamoDB 레코드**이며, 실제 에이전트 실행 결과가 아님.

### 2.4 예산 예약 통합 테스트

`tests/finance/budget.integration.test.ts` (DynamoDB Local): 일일 예산 예약·정산·해제·동시성 시나리오 **통과** (전체 통합 스위트 82 tests 중 포함).

---

## 3. 정확도 (Accuracy) — Mock·시나리오 기반

### 3.1 데모 시나리오 (`demo-scenario.integration.test.ts`)

**7개 테스트 전부 통과** (동일 실행 로그):

| Step | 검증 내용 | 측정/로그 |
|------|-----------|-----------|
| 1 | KR 봇 생성 | 봇 ID 생성, template `kr-stock`, 66 ms |
| 2 | 공시 검색·분석 | 응답에 「삼성전자」 포함, steps=2, calls=2, cost=$0.000375 |
| 3 | 가설 저장 | evidence **2개**, DART URL 포함 |
| 4 | 가설 업데이트 | version **2**, evidence **3개** |
| 5 | 메모리 복원 | user=**3**, assistant=**7**, tool=**4** 메시지 |
| 6 | URL 무결성 | **3개** 증거 모두 `https` DART URL |
| 7 | 전체 지연 | 총 **&lt; 30 s** (해당 실행 약 0.8 s대) |

**출처 인용(UI)**: E2E에서 assistant 메시지에 출처 카드 `source-citation-list` **≥ 2**, `date-precision-badge` 존재 assert.

**날짜 정밀도**: UI 배지 문구 「일 단위 (DART 공시 기준)」; 회귀 테스트 `Regression: 미래 공시는 retrospective 분석에서 경고 표시` **통과** (fixture `FUTURE_FILING`).

**미측정**: 실 OpenDART 키로의 대규모 정확도 벤치마크, 인간 평가.

---

## 4. 복원력 (Resilience) — 통합 테스트 실측

`TEST_TYPE=integration npm run test:finance:integration` (2026-10-12):

```
# tests 82
# pass 82
# fail 0
```

### 4.1 강제 종료·복구 (`worker.integration.test.ts` — Forced-kill recovery scenarios)

| 테스트 | 내용 |
|--------|------|
| recovery after worker crash post-create (before lease acquisition) | Run 생성 후 워커 사망 → 재처리 |
| recovery after worker crash before commit (no duplicate completion) | lease 후 commit 전 사망 → 중복 완료 없음 |
| no duplicate after worker crash post-commit | commit 후 사망 → 멱등 완료 |
| checkpoint preserved across crash and recovery | 체크포인트 유지 |

**4/4 통과** (위 스위트 실행 시).

### 4.2 중복 Run 방지

| 테스트 | 내용 |
|--------|------|
| duplicate events produce no duplicate runs | 동일 idempotency로 중복 이벤트 → 단일 Run |

**1/1 통과**.

### 4.3 Fencing·원자 완료

| 영역 | 테스트 수 (worker.integration) |
|------|-------------------------------|
| late worker cannot overwrite completed run (fencing) | 포함 |
| Atomic report+memory+completion transaction | 2 tests |
| Tombstone / stale event | 4 tests |

(세부는 `worker.integration.test.ts` describe 블록 — 전부 통합 스위트 82 pass에 포함.)

### 4.4 SQS partial batch / DLQ

`SQS partial batch failure and DLQ redrive` describe:

| 테스트 | 3 |
|--------|---|
| batchItemFailures, DLQ redrive 검증, stale version 거부 | **3/3 통과** |

### 4.5 Reconciliation

`DB/Scheduler/Run reconciliation` describe: **3/3 통과**.

---

## 5. 테스트 스위트 규모 (실행 결과)

| 스위트 | 명령 | 결과 (2026-10-12) |
|--------|------|-------------------|
| 단위 | `npm run test:finance` | **148 / 148 pass** |
| 통합 | `TEST_TYPE=integration npm run test:finance:integration` | **82 / 82 pass** |
| UI E2E | `npx tsx tests/finance/finance-ui.e2e.ts` | **PASS** (18 스크린샷, 가로 overflow·단일 테마 토글·채팅 chrome 등 assert) |

---

## 6. 아직 없는 것 (제안 시 명시 권장)

- 프로덕션 OpenRouter/OpenDART **실키** 기반 비용·지연 p50/p95
- 다사용자·다일 트래픽에서의 일일 예산 소진률
- 인간 라벨링 기반 공시 분석 정확도
- AWS 상 DynamoDB/SQS **실계정** 장애 주입 결과

---

## 7. 재현 명령

```bash
npm run test:finance
TEST_TYPE=integration npm run test:finance:integration
TEST_TYPE=integration node --conditions=react-server --import tsx --test tests/finance/demo-scenario.integration.test.ts
npx tsx tests/finance/finance-ui.e2e.ts
```

---

**면책**: 본 문서의 금액·토큰·지연은 Mock/로컬 DynamoDB 환경에서의 테스트 출력이며, 운영 환경과 다를 수 있습니다.
