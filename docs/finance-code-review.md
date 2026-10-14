# Finance branch code review (`feat/finance-auth`)

Review date: 2026-10-14 (updated). Scope: finance auth, API routes under `app/api/finance`, `features/finance-auth`, `shared/finance`. **Excluded:** `/ai`, blog assistant, `entities/post`.

## Sources applied

| Source | Link | How used |
|--------|------|----------|
| Vercel React Best Practices | [vercel-labs/agent-skills `react-best-practices`](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md) | Waterfalls, `async-parallel`, `bundle-dynamic-import`, `rerender-defer-reads`, JS lookups |
| Karpathy-style guidelines | [multica-ai/andrej-karpathy-skills `karpathy-guidelines`](https://github.com/multica-ai/andrej-karpathy-skills/blob/HEAD/skills/karpathy-guidelines/SKILL.md) | Simplicity, surgical diffs, delete dead code, verify with tests |

No primary source authored by Andrej Karpathy under the exact name **improve-code-architecture** was found.

---

## Status (deferred items from original review)

| Item | Status | Notes |
|------|--------|--------|
| Server load of messages on bot switch + cache | **Done** | `GET /api/finance/bots/:botId/messages`, `useBotMessages`, `messagesLoadedBotIds`, race-safe fetch |
| `next/dynamic` for modals | **Done** | `finance-dynamic-modals.tsx` (create bot, bot detail, run/routine modals) |
| Zustand narrow selectors / `useShallow` | **Done** | Finance shell, lists, chat, sidebar, sources |
| Split `RunList` / `RoutineList` | **Done** | `run-card`, `run-detail-modal`, `routine-card`, `create-routine-modal`, etc. |
| `npm run typecheck` clean | **Done** | `typecheck` script; `password-hash.test.ts` env typing |
| Structured output / typed chat components | **Out of scope** | Not started (per task) |
| Finance shell as RSC + server data layer | **Deferred** | Would change auth/caching contracts; client Zustand app remains appropriate for now |
| Repository / server-actions migration for all fetches | **Deferred** | APIs already backed by `shared/finance`; moving UI fetch to RSC is a separate milestone |

---

## First pass (2026-10-14) — implemented

| Commit | Change |
|--------|--------|
| `ca7cf2c` | This review document (initial). |
| `2825d11` | `shared/finance/constants.ts` + chat route — single `MAIN_BOT_ID`. |
| `d7fd73d` | Remove unused `BotList.tsx`. |
| `ea86286` | `getActiveBotDisplayMeta()`, unit tests, list name maps. |
| `3e10550` | Parallel initial/refresh fetches in `FinanceHome`. |
| `ab791b7` | `bot-avatar.tsx` import cleanup. |
| `5a8a766` | Doc ↔ commit table. |

---

## Second pass — see git log on `feat/finance-auth`

Themes: typecheck fix, bot messages API + cache, dynamic modals, Zustand selectors, list module splits, doc status table.

---

## Verification

`npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:finance`, `TEST_TYPE=integration npm run test:finance:integration`, `npm run test:site:e2e`, `npx tsx tests/finance/finance-ui.e2e.ts`.
