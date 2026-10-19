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

## 1b. One-time bootstrap (OIDC + CI)

### AWS CDK bootstrap (operator, once per account/region)

```bash
export AWS_REGION=ap-northeast-2
pnpm infra:finance-auth bootstrap
```

### GitHub Actions → AWS (no long-lived keys)

1. Deploy the GitHub OIDC stack **once** with an admin AWS profile (or import an existing provider):

```bash
pnpm infra:finance-github-oidc deploy -c githubRepository=jglee96/zakkdev
# If token.actions.githubusercontent.com provider already exists:
# -c existingGithubOidcProviderArn=arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com
```

2. In GitHub **repository variables** (Settings → Secrets and variables → Actions → Variables), set:

| Variable | Example / source |
|----------|------------------|
| `AWS_REGION` | `ap-northeast-2` |
| `FINANCE_GITHUB_DEPLOY_ROLE_ARN` | `FinanceGithubOidc` output `GithubDeployRoleArn` |
| `FINANCE_GITHUB_DIFF_ROLE_ARN` | output `GithubDiffRoleArn` |
| `FINANCE_VERCEL_RUNTIME_ROLE_NAME` | `finance-vercel-runtime` (must match CDK) |
| `FINANCE_VERCEL_TEAM_SLUG` | Vercel team URL slug |
| `FINANCE_VERCEL_PROJECT_NAME` | Vercel project name (e.g. `zakkdev`) |
| `FINANCE_BUDGET_TABLE_ARN` | optional, for worker deploy context |
| `FINANCE_DATA_TABLE_NAME` | optional fixed DynamoDB table name |

3. Enable GitHub **environment** `production` with required reviewers (workflow deploy job uses it).

After the first manual bootstrap, pushes to `main` that touch `infra/**` run `.github/workflows/finance-infra.yml` deploy. PRs run typecheck, tests, `cdk synth`, and optional `cdk diff` (when `FINANCE_GITHUB_DIFF_ROLE_ARN` is set).

### Vercel → AWS (OIDC, recommended)

1. Deploy the Vercel OIDC stack (creates `oidc.vercel.com/<teamSlug>` provider + runtime role):

```bash
pnpm infra:finance-vercel-oidc deploy \
  -c vercelTeamSlug=YOUR_TEAM_SLUG \
  -c vercelProjectName=zakkdev \
  -c vercelRuntimeRoleName=finance-vercel-runtime
```

2. In Vercel project env (Production), set:

| Variable | Value |
|----------|--------|
| `AWS_ROLE_ARN` | `FinanceVercelOidc` output `VercelRuntimeRoleArn` |
| `AWS_REGION` | same as stacks |

The app uses `shared/finance/aws/credentials.ts`: on Vercel with `AWS_ROLE_ARN`, it calls `@vercel/functions/oidc` `awsCredentialsProvider`; otherwise it uses the AWS SDK default chain (env keys, instance role, SSO).

**Fallback (static keys):** set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (and `AWS_SESSION_TOKEN` if needed) on Vercel instead of `AWS_ROLE_ARN`. No code changes required; rotate keys manually.

**Moving off Vercel:** deploy the Next.js app elsewhere and keep using the default credential chain (keys or instance role). Only change `shared/finance/aws/credentials.ts` if the new host has a different OIDC helper.

## 2. CDK stacks (order)

```bash
export AWS_REGION=ap-northeast-2

# OIDC (once; see §1b)
pnpm infra:finance-github-oidc deploy -c githubRepository=jglee96/zakkdev
pnpm infra:finance-vercel-oidc deploy \
  -c vercelTeamSlug=YOUR_TEAM_SLUG \
  -c vercelProjectName=zakkdev \
  -c vercelRuntimeRoleName=finance-vercel-runtime

# Login rate limits
pnpm infra:finance-auth synth
pnpm infra:finance-auth deploy -c runtimeRoleName=finance-vercel-runtime

# Daily LLM budget (optional but recommended)
pnpm infra:finance-budget deploy -c runtimeRoleName=finance-vercel-runtime

# Worker queue, single data table, scheduler roles, bundled worker Lambda
pnpm infra:finance-worker deploy \
  -c vercelRuntimeRoleName=finance-vercel-runtime \
  -c budgetTableArn=arn:aws:dynamodb:REGION:ACCOUNT:table/FinanceBudget-... \
  -c financeDataTableName=zakkdev-finance-data   # optional fixed name
```

Capture **outputs** from `finance-worker` deploy (see section 4).

## 3. Secrets (AWS Secrets Manager)

The **worker Lambda** does not store API keys in plain environment variables. CDK (`infra/finance-worker.ts`) imports existing secrets by **name** and passes their ARNs to the function as `OPENROUTER_SECRET_ARN` and `OPENDART_SECRET_ARN`. At cold start, `infra/lambda/finance-worker/load-runtime-secrets.ts` fetches each secret and sets `OPENROUTER_API_KEY` / `OPENDART_API_KEY` in `process.env`.

### Names and JSON shape (must match code)

| Secret name (CDK default) | Lambda env (ARN) | After load |
|---------------------------|------------------|------------|
| `finance/openrouter-api-key` | `OPENROUTER_SECRET_ARN` | `OPENROUTER_API_KEY` |
| `finance/opendart-api-key` | `OPENDART_SECRET_ARN` | `OPENDART_API_KEY` |

- **Secret name** — Defaults above unless you deploy with `-c openRouterSecretName=...` or `-c openDartSecretName=...` (same strings you use in `create-secret --name`).
- **Secret value** — Prefer JSON with the key **`apiKey`** (lowercase). The loader also accepts `API_KEY` or `key`, or a **plain string** (entire secret body is the key). Example:

```json
{"apiKey":"YOUR_KEY_HERE"}
```

Use the same region as the worker stack (`AWS_REGION`, e.g. `ap-northeast-2`).

**Vercel chat** does not read Secrets Manager for these keys. Set **`OPENROUTER_API_KEY`** and **`OPENDART_API_KEY`** in the Vercel project (mark both **Sensitive**). **Local dev** uses the same variable names in **`.env.local`** (covered by `.gitignore` via `.env*.local` — never commit keys).

### 3a. AWS CLI

Set region once (matches deploy):

```bash
export AWS_REGION=ap-northeast-2
```

**Option A — prompt for key (avoids shell history)**

```bash
read -s -p "OpenRouter API key: " OPENROUTER_KEY; echo
aws secretsmanager create-secret \
  --region "$AWS_REGION" \
  --name finance/openrouter-api-key \
  --description "OpenRouter API key for finance worker Lambda" \
  --secret-string "$(printf '{"apiKey":"%s"}' "$OPENROUTER_KEY")"
unset OPENROUTER_KEY

read -s -p "OpenDART API key: " OPENDART_KEY; echo
aws secretsmanager create-secret \
  --region "$AWS_REGION" \
  --name finance/opendart-api-key \
  --description "OpenDART API key for finance worker Lambda" \
  --secret-string "$(printf '{"apiKey":"%s"}' "$OPENDART_KEY")"
unset OPENDART_KEY
```

**Option B — temp file (no key on the command line)**

```bash
umask 077
printf '%s' '{"apiKey":"PASTE_KEY_HERE"}' > /tmp/finance-openrouter-secret.json
aws secretsmanager create-secret \
  --region "$AWS_REGION" \
  --name finance/openrouter-api-key \
  --secret-string file:///tmp/finance-openrouter-secret.json
shred -u /tmp/finance-openrouter-secret.json 2>/dev/null || rm -f /tmp/finance-openrouter-secret.json

# Repeat for OpenDART with finance/opendart-api-key and a separate temp file.
```

If `create-secret` fails because the name already exists, use **update** (rotation) instead:

```bash
read -s -p "New OpenRouter API key: " OPENROUTER_KEY; echo
aws secretsmanager put-secret-value \
  --region "$AWS_REGION" \
  --secret-id finance/openrouter-api-key \
  --secret-string "$(printf '{"apiKey":"%s"}' "$OPENROUTER_KEY")"
unset OPENROUTER_KEY
```

**Verify without printing the secret**

```bash
aws secretsmanager describe-secret \
  --region "$AWS_REGION" \
  --secret-id finance/openrouter-api-key \
  --query '{Name:Name,ARN:ARN,LastChangedDate:LastChangedDate,VersionIdsToStages:VersionIdsToStages}' \
  --output table

aws secretsmanager describe-secret --region "$AWS_REGION" --secret-id finance/opendart-api-key --output table
```

Do **not** use `get-secret-value` in shared logs or CI; use `describe-secret` to confirm existence and ARN. After `finance-worker` deploy, confirm stack outputs / Lambda env ARNs match these secrets.

Create secrets **before** or **after** CDK deploy: CDK references secrets by name (`Secret.fromSecretNameV2`); the secrets must exist before the worker can successfully cold-start.

### 3b. AWS Console

1. Open **AWS Secrets Manager** in the same region as the stack.
2. **Store a new secret** → **Other type of secret**.
3. **Key/value** — Add one key: `apiKey`, value = your API key (Console builds JSON for you). Alternatively paste **Plaintext** JSON: `{"apiKey":"..."}`.
4. **Secret name** — Exactly `finance/openrouter-api-key` or `finance/opendart-api-key` (or your CDK context override).
5. Leave rotation disabled unless you configure rotation separately; routine key rotation is done with **Store a new secret value** on the secret detail page (equivalent to `put-secret-value`).
6. Repeat for the second provider.
7. On the secret detail page, copy **ARN** only if you need to cross-check with Lambda configuration; CDK wires ARNs automatically on deploy.

### 3c. Chat vs worker (summary)

| Runtime | OpenRouter / OpenDART |
|---------|------------------------|
| Worker Lambda | Secrets Manager → `apiKey` JSON → in-memory `OPENROUTER_API_KEY` / `OPENDART_API_KEY` |
| Vercel (chat API) | Project env: `OPENROUTER_API_KEY`, `OPENDART_API_KEY` (**Sensitive**) |
| Local (`pnpm dev`) | `.env.local` with the same names; file is gitignored |

## 4. Vercel environment variables

### Auth (required)

| Variable | Source |
|----------|--------|
| `FINANCE_PASSWORD_HASH` | Argon2 PHC hash (`pnpm finance:credentials`) |
| `FINANCE_SESSION_SECRET` | Random 32+ bytes base64url |
| `FINANCE_APP_ORIGIN` | Exact site origin (e.g. `https://zakklee.dev`) |
| `FINANCE_AUTH_TABLE` | `FinanceAuth` stack output `AuthTableName` |
| `AWS_REGION` | Same as tables |
| `AWS_ROLE_ARN` | Vercel OIDC runtime role ARN (recommended on Vercel) |

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

`auto` mode (non-production only): uses `fake` when `FINANCE_DYNAMODB_ENDPOINT` is set; uses `aws` when **all three** scheduler ARNs (queue, DLQ, role) are set; otherwise `off`.

On **Vercel production** (`VERCEL_ENV=production`), routine mutations **fail with HTTP 503** unless `FINANCE_SCHEDULER_MODE=aws` and queue, DLQ, and role ARNs are configured — silent `off`/`fake`/`noop` is blocked.

### Chat / worker LLM

See **section 3** for Secrets Manager setup. Vercel chat needs both keys in project env (Sensitive); the worker loads them from ARNs at Lambda cold start.

| Variable | Where |
|----------|--------|
| `OPENROUTER_API_KEY` | Vercel (chat), or `.env.local` locally |
| `OPENDART_API_KEY` | Vercel (chat), or `.env.local` locally |
| `OPENROUTER_SECRET_ARN` / `OPENDART_SECRET_ARN` | Set by CDK on worker Lambda only |

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
pnpm infra:finance-github-oidc synth -c githubRepository=jglee96/zakkdev
pnpm infra:finance-vercel-oidc synth -c vercelTeamSlug=ci-team -c vercelProjectName=zakkdev
pnpm infra:finance-worker synth
pnpm test:finance   # includes CDK assertion tests
```

## 7. Post-deploy smoke

1. Log in to `/finance`.
2. Create a routine; confirm status `active` and `schedulerName` in API response.
3. Confirm schedule in AWS Scheduler group `finance-routines`.
4. (Optional) Trigger queue message or wait for cron; confirm run row in `FINANCE_DATA_TABLE`.
