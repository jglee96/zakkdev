/**
 * Playwright orchestrator for modal stacking context collection.
 *
 * 1. Boots the same production finance server harness as finance-ui.e2e.ts
 * 2. Uses Playwright Chromium to log in, open the bot-create modal
 * 3. Injects stacking-context-collector via page.evaluate (computed styles)
 *
 * Usage:
 *   STACKING_LABEL=after npx tsx tests/finance/collect-modal-stacking.playwright.ts
 *   STACKING_LABEL=before STACKING_SKIP_BUILD=1 …  (when .next already built at that commit)
 */

import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { hash } from "@node-rs/argon2";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { chromium } from "playwright";
import { STACKING_CONTEXT_COLLECTOR } from "./stacking-context-collector";

const LABEL = process.env.STACKING_LABEL ?? "after";
const SKIP_BUILD = process.env.STACKING_SKIP_BUILD === "1";
const USE_DEV_SERVER = process.env.STACKING_USE_DEV_SERVER !== "0";
const PORT = Number(process.env.STACKING_PORT ?? "4211");
const ORIGIN = `http://127.0.0.1:${PORT}`;
const OUT_PATH =
  process.env.STACKING_OUT ?? `/opt/cursor/artifacts/modal-stacking-${LABEL}.json`;

function freePort(port: number) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: "ignore" });
    const pids = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: "utf8" }).trim();
    for (const pid of pids.split(/\s+/).filter(Boolean)) {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

async function waitForTableActive(db: DynamoDBClient, tableName: string) {
  for (let i = 0; i < 40; i++) {
    const described = await db.send(new DescribeTableCommand({ TableName: tableName }));
    if (described.Table?.TableStatus === "ACTIVE") return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`DynamoDB table not active: ${tableName}`);
}

async function createAuthTable(db: DynamoDBClient, tableName: string) {
  await db.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      BillingMode: "PAY_PER_REQUEST",
    }),
  );
  await waitForTableActive(db, tableName);
}

async function createDataTable(db: DynamoDBClient, tableName: string) {
  await db.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
        { AttributeName: "ownerId", AttributeType: "S" },
        { AttributeName: "statusCreatedAt", AttributeType: "S" },
        { AttributeName: "routineId", AttributeType: "S" },
        { AttributeName: "scheduledAt", AttributeType: "S" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "ByOwnerStatus",
          KeySchema: [
            { AttributeName: "ownerId", KeyType: "HASH" },
            { AttributeName: "statusCreatedAt", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
        {
          IndexName: "ByRoutineScheduled",
          KeySchema: [
            { AttributeName: "routineId", KeyType: "HASH" },
            { AttributeName: "scheduledAt", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
      BillingMode: "PAY_PER_REQUEST",
    }),
  );
  await waitForTableActive(db, tableName);
}

async function main() {
  const authTable = `FinanceAuthStack-${randomUUID()}`;
  const dataTable = `FinanceDataStack-${randomUUID()}`;
  const password = randomBytes(24).toString("base64url");
  const secret = randomBytes(32).toString("base64url");

  const db = new DynamoDBClient({
    region: "ap-northeast-2",
    endpoint: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
  await createAuthTable(db, authTable);
  await createDataTable(db, dataTable);

  const passwordHash = await hash(password);
  const runtimeEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
    FINANCE_PASSWORD_HASH: passwordHash,
    FINANCE_SESSION_SECRET: secret,
    FINANCE_APP_ORIGIN: ORIGIN,
    FINANCE_AUTH_TABLE: authTable,
    FINANCE_DATA_TABLE: dataTable,
    AWS_REGION: "ap-northeast-2",
    FINANCE_DYNAMODB_ENDPOINT: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
  };

  freePort(PORT);
  if (USE_DEV_SERVER) {
    console.log(`[${LABEL}] Starting next dev (NODE_ENV=development)…`);
  } else if (!SKIP_BUILD) {
    await rm(path.join(process.cwd(), ".next"), { recursive: true, force: true });
    console.log(`[${LABEL}] Building production bundle…`);
    await new Promise<void>((resolve, reject) => {
      const buildProcess = spawn("npm", ["run", "build"], {
        stdio: "inherit",
        env: { ...runtimeEnv, NODE_ENV: "production" },
      });
      buildProcess.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Build failed with code ${code}`));
      });
    });
  }

  const server = USE_DEV_SERVER
    ? spawn("npm", ["run", "dev", "--", "-p", String(PORT)], {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...runtimeEnv, NODE_ENV: "development" },
      })
    : spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...runtimeEnv, NODE_ENV: "development" },
      });

  let serverLogs = "";
  server.stdout?.on("data", (c) => {
    serverLogs = (serverLogs + c.toString()).slice(-12000);
  });
  server.stderr?.on("data", (c) => {
    serverLogs = (serverLogs + c.toString()).slice(-12000);
  });

  let ready = false;
  for (let i = 0; i < USE_DEV_SERVER ? 120 : 60; i++) {
    if (server.exitCode !== null) throw new Error(`Server exited before readiness: ${serverLogs}`);
    try {
      const resp = await fetch(`${ORIGIN}/finance/login`, { signal: AbortSignal.timeout(2000) });
      ready = resp.status === 200;
    } catch {
      /* retry */
    }
    if (ready) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready, `Server did not become ready: ${serverLogs}`);
  if (USE_DEV_SERVER) await new Promise((r) => setTimeout(r, 3000));

  const loginResponse = await fetch(`${ORIGIN}/api/finance/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ password }),
  });
  assert.equal(loginResponse.status, 200, `API login failed: ${await loginResponse.text()}\n${serverLogs}`);
  const setCookieHeader = loginResponse.headers.get("set-cookie");
  assert.ok(setCookieHeader, "Login response should set session cookie");
  const cookiePair = setCookieHeader.split(";")[0];
  const eq = cookiePair.indexOf("=");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.context().addCookies([
    {
      name: cookiePair.slice(0, eq),
      value: cookiePair.slice(eq + 1),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
    },
  ]);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ORIGIN}/finance`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="create-bot-btn"]');
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="create-bot-btn"]') as HTMLElement | null;
    btn?.click();
  });
  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector(".finance-modal-overlay, .mantine-Modal-overlay") &&
          document.querySelector('[role="dialog"]'),
      ),
    { timeout: 15000 },
  );
  await page.waitForTimeout(500);

  const data = await page.evaluate((source) => {
    const fn = new Function(`${source}\nreturn collectModalStackingContext();`) as () => Record<string, unknown>;
    return fn();
  }, STACKING_CONTEXT_COLLECTOR);

  const gitSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  const payload = {
    label: LABEL,
    gitSha,
    collectedAt: new Date().toISOString(),
    viewport: { width: 1440, height: 900 },
    collector: "playwright page.evaluate + stacking-context-collector",
    ...data,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));

  await browser.close();
  if (server.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* ignore */
    }
  }
  freePort(PORT);
  await db.send(new DeleteTableCommand({ TableName: authTable })).catch(() => undefined);
  await db.send(new DeleteTableCommand({ TableName: dataTable })).catch(() => undefined);
  db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
