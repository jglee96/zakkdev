/**
 * Capture blog + finance screenshots for design alignment review.
 *
 *   FINANCE_E2E_SKIP_BUILD=1 npx tsx tests/screenshots/capture-design-screenshots.ts
 */

import { execSync, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { hash } from "@node-rs/argon2";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

const PORT = 4204;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const OUT_DIR = "/opt/cursor/artifacts/design-alignment";
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const BLOG_ROUTES = [
  { slug: "blog-home", path: "/" },
  { slug: "blog-list", path: "/blog" },
  { slug: "blog-post", path: "/blog/2026-06-18-hawaiian" },
] as const;

const FINANCE_ROUTES = [
  { slug: "finance-login", path: "/finance/login", auth: false },
  { slug: "finance-chat", path: "/finance", tab: "bot-workspace-tab-chat", auth: true },
  { slug: "finance-bots", path: "/finance", sidebarBot: "bot-sidebar-item-bot-kr-stock", auth: true },
  { slug: "finance-runs", path: "/finance", tab: "bot-workspace-tab-runs", auth: true },
] as const;

async function waitForTableActive(db: DynamoDBClient, tableName: string) {
  for (let i = 0; i < 40; i++) {
    const described = await db.send(new DescribeTableCommand({ TableName: tableName }));
    if (described.Table?.TableStatus === "ACTIVE") return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Table not active: ${tableName}`);
}

function freePort(port: number) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: "ignore" });
    execSync(`pkill -f 'next start -p ${port}' 2>/dev/null || true`, { stdio: "ignore" });
  } catch {
    /* ignore */
  }
}

async function shot(page: Page, name: string, viewport: { width: number; height: number }) {
  await page.setViewport(viewport);
  await new Promise((r) => setTimeout(r, 600));
  const file = path.join(OUT_DIR, `${name}.png`);
  const buf = await page.screenshot({ fullPage: false });
  await writeFile(file, buf);
  console.log(`  📸 ${file}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const password = randomBytes(24).toString("base64url");
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
  const secret = randomBytes(32).toString("base64url");
  const authTable = `FinanceAuthShot-${randomUUID()}`;
  const dataTable = `FinanceDataShot-${randomUUID()}`;

  const db = new DynamoDBClient({
    region: "ap-northeast-2",
    endpoint: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
  const doc = DynamoDBDocumentClient.from(db, { marshallOptions: { removeUndefinedValues: true } });
  await db.send(
    new CreateTableCommand({
      TableName: authTable,
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      BillingMode: "PAY_PER_REQUEST",
    }),
  );
  await waitForTableActive(db, authTable);
  await db.send(
    new CreateTableCommand({
      TableName: dataTable,
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
      ],
      BillingMode: "PAY_PER_REQUEST",
    }),
  );
  await waitForTableActive(db, dataTable);

  const runtimeEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
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
  if (process.env.FINANCE_E2E_SKIP_BUILD !== "1") {
    execSync("npm run build", { stdio: "inherit", env: { ...runtimeEnv, NODE_ENV: "production" } });
  }

  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    detached: true,
    stdio: "ignore",
    env: runtimeEnv,
  });

  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${ORIGIN}/`)).status === 200) break;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();

  console.log("\nBlog pages\n");
  for (const route of BLOG_ROUTES) {
    await page.goto(`${ORIGIN}${route.path}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="site-header"]', { timeout: 30000 });
    await shot(page, `blog-${route.slug}-desktop-1440x900`, DESKTOP);
    await shot(page, `blog-${route.slug}-mobile-390x844`, MOBILE);
  }

  const loginRes = await fetch(`${ORIGIN}/api/finance/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ password }),
  });
  if (loginRes.status !== 200) {
    throw new Error(`Login failed for screenshots: ${loginRes.status} ${await loginRes.text()}`);
  }
  const setCookieHeader = loginRes.headers.get("set-cookie");
  if (!setCookieHeader) throw new Error("Login did not return Set-Cookie");
  const cookiePair = setCookieHeader.split(";")[0];
  const [cookieName, ...cookieValueParts] = cookiePair.split("=");
  await page.setCookie({
    name: cookieName,
    value: cookieValueParts.join("="),
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
  });

  await doc.send(
    new PutCommand({
      TableName: dataTable,
      Item: {
        pk: "OWNER#finance-owner",
        sk: "BOT#bot-kr-stock",
        entityType: "Bot",
        id: "bot-kr-stock",
        ownerId: "finance-owner",
        name: "한국 주식 분석봇",
        template: "kr-stock",
        status: "active",
        allowedTools: [],
        instructions: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    }),
  );

  console.log("\nFinance pages\n");
  for (const route of FINANCE_ROUTES) {
    await page.goto(`${ORIGIN}${route.path}`, { waitUntil: "domcontentloaded" });
    if (route.auth) {
      await page.setViewport(DESKTOP);
      if ("tab" in route && route.tab) {
        await page.waitForSelector(`[data-testid="${route.tab}"]`, { timeout: 30000 });
        await page.evaluate((id) => {
          const el = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
          el?.click();
        }, route.tab);
        await new Promise((r) => setTimeout(r, 1000));
      }
      if ("sidebarBot" in route && route.sidebarBot) {
        await page.waitForSelector(`[data-testid="${route.sidebarBot}"]`, { timeout: 30000 });
        await page.evaluate((id) => {
          const el = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
          el?.click();
        }, route.sidebarBot);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    await shot(page, `finance-${route.slug}-desktop-1440x900`, DESKTOP);
    await shot(page, `finance-${route.slug}-mobile-390x844`, MOBILE);
  }

  await browser.close();
  try {
    process.kill(-server.pid!, "SIGKILL");
  } catch {
    /* ignore */
  }
  freePort(PORT);
  await db.send(new DeleteTableCommand({ TableName: authTable })).catch(() => undefined);
  db.destroy();
  console.log(`\nDone. Screenshots in ${OUT_DIR}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
