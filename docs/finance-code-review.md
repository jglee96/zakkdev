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
| Routine → AWS Scheduler orchestrator | **Deferred** | `createRoutineWithScheduler` not wired from HTTP/agent; changes prod scheduling contract |
| Worker Lambda bundle (real `handleSQSEvent`) | **Deferred** | CDK stub; needs deploy pipeline |
| CDK multi-table vs single `FINANCE_DATA_TABLE` | **Deferred** | Document/code alignment is infra milestone |
| Chat POST rate limit | **Deferred** | Login has rate limit; LLM path uses budget/cost only |
| Unify `FinanceShell*` and Zustand types | **Deferred** | Store clones on hydrate; single type source is cosmetic |
| Remove legacy markdown parser | **Deferred** | Until historical messages migrated (`docs/finance-structured-chat.md`) |
| RSC `selectedBotId` cookie / URL | **Deferred** | Full reload always opens main bot (unchanged product behavior) |

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
| **P0** | Routines never activated via scheduler from API | **Deferred** — orchestrator wiring + env contract |
| **P1** | Worker not deployed as real Lambda handler | **Deferred** — infra |
| **P2** | `runtime.ts` dynamic `require()` for cycles | **Deferred** — document/split in agent refactor |
| **P3** | Duplicate `MAIN_BOT_ID` import paths in UI | **Deferred** — cosmetic |

---

## Structured output / worker (review notes)

- **Chat:** `respond` tool → `finalize-response` / `validate-response` → persisted on `createMessage`; UI uses `ChatMessageContent` + cards with legacy fallback.
- **Worker:** `runAgentForWorker` mirrors chat; `agentRunResultToReportData` → run `reportData`; UI uses same card stack in run list/detail.
- **Tests:** `structured-response.test.ts`, `worker-report-data.test.ts`, `demo-scenario.integration.test.ts`.

---

## Verification (third pass)

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test:finance
TEST_TYPE=integration pnpm test:finance:integration
pnpm exec tsx tests/finance/finance-ui.e2e.ts
```

---

## Commit log (third pass — see branch `cursor/finance-rsc-shell-50b8`)

Themes: shared serializers, main-bot resolution, finance error boundaries, dead code removal, doc update.
