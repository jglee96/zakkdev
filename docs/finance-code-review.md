# Finance branch code review (`feat/finance-auth`)

Review date: 2026-10-14. Scope: finance auth, API routes under `app/api/finance`, `features/finance-auth`, `shared/finance`. **Excluded:** `/ai`, blog assistant, `entities/post`.

## Sources applied

| Source | Link | How used |
|--------|------|----------|
| Vercel React Best Practices | [vercel-labs/agent-skills `skills/react-best-practices/SKILL.md`](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md) | Waterfalls, bundle/server/client, re-renders, JS lookups |
| Karpathy-style guidelines (not an official Karpathy repo named “improve-code-architecture”) | [multica-ai/andrej-karpathy-skills `karpathy-guidelines`](https://github.com/multica-ai/andrej-karpathy-skills/blob/HEAD/skills/karpathy-guidelines/SKILL.md) | Simplicity, surgical diffs, delete dead code, verify with tests |
| “improve-code-architecture” (third-party skill, **not** Karpathy) | [zachcr-ws/improve-code-architecture](https://github.com/zachcr-ws/improve-code-architecture) | Cited only for deferred large restructures (DI, ports/adapters) — **not** implemented in this pass |

No primary source authored by Andrej Karpathy under the exact name **improve-code-architecture** was found; principles above substitute per task instructions.

---

## Critical — bugs / security

| Finding | Location | Rule / note |
|---------|----------|-------------|
| No new critical bugs identified in UI-only review pass. Auth continues to flow through `requireFinanceSession` on finance API routes. | `app/api/finance/**`, `shared/finance/auth/guard.ts` | `server-auth-actions` — keep session guard on every mutating route (already present). |
| `MAIN_BOT_ID` duplicated in chat route vs UI constants risks drift. | `app/api/finance/chat/route.ts`, `features/finance-auth/constants.ts` | Surgical fix: single `shared/finance/constants.ts`. |

---

## High — architecture / maintainability

| Finding | Location | Rule / note |
|---------|----------|-------------|
| **Dead module:** `BotList.tsx` (~340 lines) unused after sidebar redesign. | `features/finance-auth/ui/BotList.tsx` | Karpathy *Simplicity First* / *Surgical Changes* — remove. |
| **Duplicated “active bot” resolution** in `FinanceHome` and `ChatPanel`. | Same files | Karpathy *minimum code* — extract `getActiveBotDisplayMeta`. |
| Chat messages never loaded from API on bot switch (only in-memory). | `ChatPanel.tsx`, store | Documented limitation; server fetch is a **deferred** product change. |
| Large list components (`RunList`, `RoutineList`) mix presentation + modals. | UI files | zachcr *improve-code-architecture* — split only if editing further (**deferred**). |

---

## Medium — React / Next performance

| Finding | Location | Rule / note |
|---------|----------|-------------|
| **Request waterfall** on finance home mount: `fetchBots` → `fetchRoutines` → `fetchRuns` sequential in one effect. | `FinanceHome.tsx` | `async-parallel` — use `Promise.all`. |
| `refreshAll` calls three fetches sequentially. | `FinanceHome.tsx` | `async-parallel`. |
| Repeated `bots.find` / `routines.find` per row in run list. | `RunList.tsx` | `js-index-maps` / `js-set-map-lookups`. |
| Entire finance shell is `"use client"` with Zustand; acceptable for interactive app but limits RSC wins. | `FinanceHome.tsx`, `app/finance/page.tsx` | `server-serialization` — **deferred** (would need data layer redesign). |
| Heavy modals always in bundle. | `create-bot-modal.tsx`, etc. | `bundle-dynamic-import` — **deferred** (needs loading UX + E2E stability). |
| `useFinanceStore()` broad subscriptions re-render shell on any field change. | Multiple UI files | `rerender-defer-reads` — **deferred** (Zustand selectors refactor). |

---

## Low — readability / consistency

| Finding | Location | Rule / note |
|---------|----------|-------------|
| Duplicate `@mantine/core` import lines. | `bot-avatar.tsx` | Style / bundle hygiene. |
| `getBotDisplayMeta` fallback uses `template: "kr-stock"` for missing bot. | `FinanceHome.tsx`, `ChatPanel.tsx` | Confusing fallback; centralized in helper (**fixed** with extract). |
| `window.__FINANCE_STORE__` for E2E. | `finance-store.ts` | Acceptable test seam; document in review only. |
| `bot-template-meta` re-exports `MAIN_BOT_ID`. | `bot-template-meta.ts` | OK for UI; API should use `shared/finance/constants`. |

---

## Implemented in this pass (see git log)

1. `shared/finance/constants.ts` + chat route import — single `MAIN_BOT_ID`.
2. Remove unused `BotList.tsx`.
3. Parallel initial/refresh fetches in `FinanceHome`.
4. `getActiveBotDisplayMeta()` — DRY active bot header logic.
5. `RunList` / `RoutineList` name maps for O(1) lookups.
6. `bot-avatar.tsx` import cleanup.

---

## Deferred (risky or large scope)

| Item | Why deferred |
|------|----------------|
| Server-side load of bots/routines/runs/messages | Behavior + caching contract; not behavior-preserving without product spec. |
| `next/dynamic` for modals | Loading states + E2E timing; bundle win is moderate. |
| Zustand shallow selectors across finance UI | Wide touch surface; needs perf profiling. |
| Split `RunList`/`RoutineList` into container + presentational | High line churn, low immediate bug risk. |
| Structured output / typed chat components | Explicitly out of scope for this task. |
| Repository layer between API routes and `shared/finance/agent` | Already exists in `shared/finance`; moving UI fetch to server actions is a separate milestone. |

---

## Verification

After changes: `npm run lint`, `npm run build`, `npm run test:finance`, `TEST_TYPE=integration npm run test:finance:integration`, `npm run test:site:e2e`, `npx tsx tests/finance/finance-ui.e2e.ts`.
