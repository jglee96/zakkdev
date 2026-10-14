# Finance deploy guide (AWS + Vercel)

Code-only reference for deploying finance auth, data, scheduled routines, and the SQS worker. **Do not commit credentials.** Run deploy commands with an operator AWS profile; store secrets in AWS Secrets Manager and Vercel env UI.

## Architecture

- **Vercel** — Next.js app (`/finance`), session auth, chat API, routine CRUD with EventBridge Scheduler.
- **DynamoDB** — Single table `FINANCE_DATA_TABLE` (bots, messages, routines, runs).
- **EventBridge Scheduler** — One schedule per active routine → SQS worker queue.
- **Lambda worker** — Consumes SQS, runs agent, writes run `reportData`.

## 1. Prerequisites

- AWS account, region `ap-northeast-2` (or your chosen region).
- CDK CLI via `pnpm infra:finance-*`.
- Vercel project with HTTPS origin matching `FINANCE_APP_ORIGIN`.

## 2. CDK stacks (order)

```bash
export AWS_REGION=ap-northeast-2

# Login rate limits
pnpm infra:finance-auth synth
pnpm infra:finance-auth bootstrap   # once per account/region
pnpm infra:finance-auth deploy -c runtimeRoleName=YOUR_VERCEL_RUNTIME_ROLE

# Daily LLM budget (optional but recommended)
pnpm infra:finance-budget deploy -c runtimeRoleName=YOUR_VERCEL_RUNTIME_ROLE

# Worker queue, single data table, scheduler roles, bundled worker Lambda
pnpm infra:finance-worker deploy \
  -c vercelRuntimeRoleName=YOUR_VERCEL_RUNTIME_ROLE \
  -c budgetTableArn=arn:aws:dynamodb:REGION:ACCOUNT:table/FinanceBudget-... \
  -c financeDataTableName=zakkdev-finance-data   # optional fixed name
```

Capture **outputs** from `finance-worker` deploy (see section 4).

## 3. Secrets (AWS Secrets Manager)

Create secrets (JSON or plain string). Example JSON:

```json
{ "apiKey": "sk-or-..." }
```

| Secret name (default) | Used by |
|------------------------|---------|
| `finance/openrouter-api-key` | Worker Lambda (`OPENROUTER_SECRET_ARN`) |
| `finance/opendart-api-key` | Worker Lambda (`OPENDART_SECRET_ARN`) |

Override names with CDK context: `-c openRouterSecretName=...` `-c openDartSecretName=...`.

Vercel chat routes use env vars directly (not Secrets Manager): set `OPENROUTER_API_KEY` and `OPENDART_API_KEY` in Vercel if chat runs on Vercel.

## 4. Vercel environment variables

### Auth (required)

| Variable | Source |
|----------|--------|
| `FINANCE_PASSWORD_HASH` | Argon2 PHC hash (`pnpm finance:credentials`) |
| `FINANCE_SESSION_SECRET` | Random 32+ bytes base64url |
| `FINANCE_APP_ORIGIN` | Exact site origin (e.g. `https://zakklee.dev`) |
| `FINANCE_AUTH_TABLE` | `FinanceAuth` stack output `AuthTableName` |
| `AWS_REGION` | Same as tables |

### Data (required for bots/chat/routines)

| Variable | Source |
|----------|--------|
| `FINANCE_DATA_TABLE` | `FinanceWorker` output `FinanceDataTableName` |

### Scheduler (production)

| Variable | Source |
|----------|--------|
| `FINANCE_SCHEDULER_MODE` | `aws` |
| `FINANCE_SCHEDULER_GROUP_NAME` | Output `SchedulerGroupName` (`finance-routines`) |
| `FINANCE_SCHEDULER_TARGET_QUEUE_ARN` | Output `VercelSchedulerTargetQueueArn` |
| `FINANCE_SCHEDULER_TARGET_DLQ_ARN` | Output `VercelSchedulerTargetDlqArn` |
| `FINANCE_SCHEDULER_ROLE_ARN` | Output `SchedulerRoleArn` |

Vercel runtime role must have scheduler IAM (attached by worker stack when `vercelRuntimeRoleName` context is set).

### Local / dev (no AWS Scheduler)

| Variable | Value |
|----------|--------|
| `FINANCE_DYNAMODB_ENDPOINT` | `http://127.0.0.1:8000` |
| `FINANCE_SCHEDULER_MODE` | `fake` (in-memory schedules) or `off` (DB-only pending routines) |

`auto` mode: uses `fake` when `FINANCE_DYNAMODB_ENDPOINT` is set; uses `aws` when scheduler target ARNs are set.

### Chat / worker LLM

| Variable | Where |
|----------|--------|
| `OPENROUTER_API_KEY` | Vercel (chat) |
| `OPENROUTER_API_KEY` / `OPENDART_API_KEY` | Loaded in Lambda from Secrets Manager ARNs at cold start |

## 5. Scheduler behavior

- **Create routine** — `createRoutineWithScheduler`: Dynamo row + schedule; rolls back row if schedule create fails.
- **Update / pause / resume** — Updates Dynamo first, then schedule state/expression.
- **Delete** — Tombstones routine in Dynamo, best-effort schedule delete.
- **Reconciliation** — `shared/finance/reconciliation` can repair drift (orphan schedules, pending without schedule).

## 6. Verification (no deploy)

```bash
pnpm typecheck
pnpm lint
pnpm test:finance
TEST_TYPE=integration pnpm test:finance:integration
pnpm infra:finance-worker synth
pnpm test:finance   # includes finance-worker-cdk snapshot test
```

## 7. Post-deploy smoke

1. Log in to `/finance`.
2. Create a routine; confirm status `active` and `schedulerName` in API response.
3. Confirm schedule in AWS Scheduler group `finance-routines`.
4. (Optional) Trigger queue message or wait for cron; confirm run row in `FINANCE_DATA_TABLE`.
