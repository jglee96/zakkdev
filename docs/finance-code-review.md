# Finance branch code review (`feat/finance-auth` + PR #52)

Review date: 2026-10-14 (third pass). Scope: finance auth, `app/finance`, `app/api/finance`, `features/finance-auth`, `shared/finance`. **Excluded:** `/ai`, blog assistant, `entities/post`.

## Sources applied

| Source | Link | How used |
|--------|------|----------|
| Vercel React Best Practices | [react-best-practices SKILL](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md) | `async-parallel` (shell loader), `bundle-` (client boundary), eliminate client waterfalls |
| Karpathy-style guidelines | [karpathy-guidelines](https://github.com/multica-ai/andrej-karpathy-skills/blob/HEAD/skills/karpathy-guidelines/SKILL.md) | Surgical diffs, delete dead code, verify with tests |

---

## Architecture snapshot (PR #52)

```text
app/finance/page.tsx (RSC)
  → verifySession → loadFinanceShellData (Promise.all)
  → <FinanceShell initialData /> (client)
       → hydrateFromServer (Zustand, once per snapshot key)
       → BotWorkspace / APIs for refresh & mutations

shared/finance/shell/     server-only loader + DTO serializers
shared/finance/api/       table repo config helper
app/api/finance/*         same serializers for list/detail JSON
```

**Dependency rule:** `shared/finance` does not import `features/*`. Shell types live in `shared/finance/shell/types.ts`; the client store clones DTOs into mutable UI state on hydrate.

---

## Status table

| Item | Status | Notes |
|------|--------|--------|
| Server load messages on bot switch + cache | **Done** | `useBotMessages` + `messagesLoadedBotIds`; main bot preloaded on RSC |
| `next/dynamic` modals | **Done** | `finance-dynamic-modals.tsx` |
| Zustand `useShallow` | **Done** | Shell, lists, chat |
| Structured chat / cards | **Done** | `shared/finance/chat/*`, UI cards, worker `reportData` |
| Finance shell RSC + server data layer | **Done (PR #52)** | `loadFinanceShellData`, `FinanceShell`, no initial client list waterfall |
| Shared API DTO serializers | **Done (this pass)** | `shared/finance/shell/serializers.ts` |
| `resolveBotForOwner` for main-bot | **Done (this pass)** | Chat + bot GET + messages; exported from `agent/index` |
| `/finance` `error.tsx` / `loading.tsx` | **Done (this pass)** | User-facing retry + login link |
| Routine → AWS Scheduler orchestrator | **Done (PR #53)** | HTTP + agent tools; fake/noop/off for local |
| Worker Lambda bundle (real `handleSQSEvent`) | **Done (PR #53)** | `NodejsFunction` + Secrets Manager ARNs |
| CDK single `FINANCE_DATA_TABLE` | **Done (PR #53)** | `FinanceData` table + GSIs; RETAIN + PITR |
| Production scheduler misconfig guard | **Done (PR #53 review)** | `assertFinanceSchedulerProductionConfig` → 503 |
| Chat POST rate limit | **Deferred** | Login has rate limit; LLM path uses budget/cost only |
| Unify `FinanceShell*` and Zustand types | **Deferred** | Store clones on hydrate; single type source is cosmetic |
| Remove legacy markdown parser | **Deferred** | Until historical messages migrated (`docs/finance-structured-chat.md`) |
| RSC `selectedBotId` cookie / URL | **Deferred** | Full reload always opens main bot (unchanged product behavior) |
| Scheduled reconciliation job | **Deferred** | `reconcileOwner` tested but not wired to cron/API |
| Update orchestrator DB-before-scheduler rollback | **Deferred** | Needs compensating transaction or reorder + idempotent schedule upsert |
| DynamoDB CMK / table migration from legacy multi-table | **Deferred** | New stack creates empty table unless operator migrates data |

---

## Findings summary (third pass)

| Sev | Finding | Action |
|-----|---------|--------|
| **P0** | Chat used `getBot("main-bot")` and could `createBot` duplicate mains | **Fixed** — `resolveBotForOwner` in chat route |
| **P1** | `GET /api/finance/bots/:id` 404 for virtual `main-bot` | **Fixed** — `resolveBotForOwner` |
| **P1** | No finance route error/loading UI | **Fixed** — `app/finance/error.tsx`, `loading.tsx` |
| **P2** | Loader vs API field mapping drift | **Fixed** — shared serializers + `getFinanceTableRepoConfig` |
| **P2** | Dead `FinanceHome`, redundant type re-export | **Fixed** — removed |
| **P2** | `__FINANCE_STORE__` exposed in production | **Fixed** — dev-only (E2E uses `NODE_ENV=development`) |
| **P0** | Routines never activated via scheduler from API | **Fixed (PR #53)** |
| **P1** | Worker not deployed as real Lambda handler | **Fixed (PR #53)** |
| **P2** | `runtime.ts` dynamic `require()` for cycles | **Deferred** — document/split in agent refactor |
| **P3** | Duplicate `MAIN_BOT_ID` import paths in UI | **Deferred** — cosmetic |

---

## Fourth pass — PR #53 review (`cursor/finance-scheduler-worker-infra-50b8`)

Review date: 2026-10-14. Focus: scheduler orchestration, worker Lambda, CDK, tests, docs.

### Findings by severity

| Sev | Area | Finding | Resolution |
|-----|------|---------|------------|
| **P0** | Scheduler mode | `FINANCE_SCHEDULER_MODE=auto` on Vercel production without ARNs resolved to **`off`**, so POST created **pending** routines with no schedules (silent failure). | **Fixed** — `assertFinanceSchedulerProductionConfig()` on routine mutations (API + agent); HTTP **503** `SCHEDULER_CONFIG`. |
| **P1** | Scheduler mode | `auto` treated queue+role as `aws` but omitted **DLQ** ARN, causing late throws in `getScheduleTargetForMode`. | **Fixed** — `auto` requires queue, DLQ, and role ARNs. |
| **P1** | Orchestration | `updateRoutineWithScheduler` writes Dynamo **before** schedule pause/update; schedule failure leaves **DB/scheduler drift** (no rollback). | **Deferred** — reorder or compensating update; reconciliation exists but is not invoked in prod. |
| **P1** | Reconciliation | `reconcileOwner` is **only called from tests**, not from API, cron, or worker. Drift after partial failures persists until manual repair. | **Deferred** — needs scheduled Lambda or admin endpoint + IAM. |
| **P2** | Orchestration | `deleteRoutineWithScheduler` tombstones DB then best-effort schedule delete (orphan schedules possible). | **Accepted** — logged; reconciliation would delete orphans when wired. |
| **P2** | Orchestration | `createRoutineWithScheduler` compensates on schedule failure (delete row) and on activate failure (delete schedule). **Good.** | Verified; integration test covers happy path only. |
| **P2** | Naming | `generateSchedulerName` = `fin-{ownerId[0:8]}-{routineId[0:8]}` — collision if two UUIDs share 8-char prefix (negligible). | **Deferred** — use full routine id hash if quotas allow longer names. |
| **P2** | Cron / TZ | `cronToAwsScheduleExpression` + per-routine `timezone` (default **Asia/Seoul** in agent tools). AWS 6-field cron. | **OK** — validated in `validateCronExpression`; limits `MAX_ROUTINES_PER_OWNER=10`, `MAX_ROUTINES_PER_BOT=5`. |
| **P2** | Worker SQS | `reportBatchItemFailures: true`, `batchSize: 1`; visibility **1080s** vs Lambda timeout **180s** (3× rule satisfied). DLQ after **5** receives. | **OK** — idempotent via `createOrGetRun`, version/tombstone checks, lease fencing. |
| **P2** | Worker | Invalid/missing message fields ack success (no retry) — intentional poison skip. | Documented in worker tests (`worker.integration.test.ts`). |
| **P2** | Worker secrets | `loadRuntimeSecretsFromEnv` cached `loaded=true` even on empty secret. | **Fixed** — throw if ARN set but no key; do not set `loaded` on failure. |
| **P2** | Lambda handler | `getBot` used `getRepositoryConfig()` while runs used `getFinanceTableRepoConfig()` (same env, redundant). | **Fixed** — single `tableRepo` for bot lookup. |
| **P2** | CDK IAM | Vercel role: scheduler API scoped to `finance-routines/*`; `PassRole` to scheduler role with `PassedToService` condition. Worker: table + queue + DLQ send + secrets read. | **OK** — scheduler role only `sqs:SendMessage` to worker + delivery DLQ. |
| **P2** | CDK data | Table `RemovalPolicy.RETAIN`, PITR on; optional `financeDataTableName` creates **new** physical table (no automatic migration). | **Deferred** — operator must export/import or point context at existing table name after schema match. |
| **P2** | CDK encryption | Default AWS-owned DynamoDB/SQS encryption. | **Deferred** — CMK if compliance requires. |
| **P3** | Tests | Orchestrator integration: happy path only; no test for schedule-create failure rollback or production assert. | **Partially fixed** — unit tests for production guard + DLQ in `auto`. |
| **P3** | Tests | Fake scheduler shared singleton reset in unit tests; integration uses fake mode — does not exercise AWS SDK. | **Accepted** — AWS behavior validated at deploy time; SDK mocked by fake client by design. |
| **P3** | Docs | Deploy doc `auto` semantics understated production risk. | **Fixed** — production 503 behavior documented. |

### Fixes applied (commits on PR #53)

1. `assertFinanceSchedulerProductionConfig`, stricter `auto` → `aws` (all ARNs), API/agent 503 handling, unit tests.
2. Worker secret load fail-fast; Lambda handler single table config.
3. `docs/finance-deploy.md` production scheduler note; this review section.

### Deferred (with reasons)

| Item | Reason |
|------|--------|
| DB-before-scheduler rollback on update | Requires transactional design or saga; current API returns 502 on schedule errors but DB already changed |
| Wire `reconcileOwner` to cron/admin | New deploy surface (Lambda + trigger + auth) out of PR #53 scope |
| Schedule name length / collision hardening | Low probability; AWS name limits |
| CDK customer-managed keys | Compliance optional |
| Multi-table → single-table data migration | Operational runbook, not code-only |
| Concurrent routine PATCH race tests | Covered partially by version conflicts in repository layer |

---

## Structured output / worker (review notes)

- **Chat:** `respond` tool → `finalize-response` / `validate-response` → persisted on `createMessage`; UI uses `ChatMessageContent` + cards with legacy fallback.
- **Worker:** `runAgentForWorker` mirrors chat; `agentRunResultToReportData` → run `reportData`; UI uses same card stack in run list/detail.
- **Tests:** `structured-response.test.ts`, `worker-report-data.test.ts`, `demo-scenario.integration.test.ts`.

---

## Verification (fourth pass)

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test:finance
TEST_TYPE=integration pnpm test:finance:integration
pnpm infra:finance-worker synth
```

---

## Commit log (third pass — see branch `cursor/finance-rsc-shell-50b8`)

Themes: shared serializers, main-bot resolution, finance error boundaries, dead code removal, doc update.

## Commit log (PR #53 + review — branch `cursor/finance-scheduler-worker-infra-50b8`)

Themes: scheduler orchestration wiring, worker CDK bundle, deploy docs, production scheduler guard, secret load hardening.
