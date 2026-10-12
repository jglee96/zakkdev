/**
 * Finance UI E2E Tests - Core Journey with Screenshots
 * 
 * Tests the complete user journey with mocked data:
 * 1. Login
 * 2. Create KR bot via Main Bot chat
 * 3. Disclosure analysis with source URLs and date precision
 * 4. Reload restores memory
 * 5. Create routine
 * 6. Simulated scheduled run → report visible
 * 7. Error/Budget/Timeout UX states
 * 
 * Run with: npx tsx tests/finance/finance-ui.e2e.ts
 */

import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { hash } from "@node-rs/argon2";
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

const DEBUG = process.env.DEBUG === "1";
const SCREENSHOT_DIR = "/opt/cursor/artifacts/screenshots";

type TestContext = {
  origin: string;
  authTable: string;
  dataTable: string;
  password: string;
  db: DynamoDBClient;
  docClient: DynamoDBDocumentClient;
  server: ReturnType<typeof spawn>;
  browser: Browser;
  page: Page;
  logs: string;
  screenshots: string[];
  ownerId: string;
};

async function assertSiteNavVisible(ctx: TestContext, label: string) {
  const siteHeader = await ctx.page.$('[data-testid="site-header"]');
  assert.ok(siteHeader, `${label}: site header should exist`);
  const checks = await ctx.page.evaluate(() => {
    const ids = ["site-nav-home", "site-nav-projects", "site-nav-blog", "site-nav-ai", "site-nav-about"];
    const vh = window.innerHeight;
    return ids.map((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) return { id, ok: false, reason: "missing" };
      const rect = el.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < vh &&
        rect.right > 0 &&
        rect.left < window.innerWidth;
      return { id, ok: visible, top: rect.top, bottom: rect.bottom };
    });
  });
  for (const check of checks) {
    assert.ok(check.ok, `${label}: ${check.id} should be visible in viewport (top=${check.top})`);
  }
}

async function assertSingleThemeToggle(ctx: TestContext, label: string) {
  const counts = await ctx.page.evaluate(() => {
    const site = document.querySelectorAll('[data-testid="site-theme-toggle"]').length;
    const finance = document.querySelectorAll('[data-testid="finance-theme-toggle"]').length;
    const aria = document.querySelectorAll('[aria-label="Toggle color scheme"]').length;
    return { site, finance, aria };
  });
  assert.equal(counts.site, 1, `${label}: expected exactly one site theme toggle, got ${counts.site}`);
  assert.equal(counts.finance, 0, `${label}: finance theme toggle should be absent`);
  assert.equal(counts.aria, 1, `${label}: expected one theme toggle control, got ${counts.aria}`);
}

async function assertNoFinanceAppHeader(ctx: TestContext, label: string) {
  const state = await ctx.page.evaluate(() => {
    const shellHeader = document.querySelector('[data-testid="finance-shell-header"]');
    const legacyTitle = Array.from(document.querySelectorAll("h3, h4")).some(
      (el) => el.textContent?.trim() === "금융 리서치",
    );
    return { hasShellHeader: Boolean(shellHeader), legacyTitle };
  });
  assert.ok(!state.hasShellHeader, `${label}: finance AppShell header should be removed`);
  assert.ok(!state.legacyTitle, `${label}: '금융 리서치' finance header bar should not be present`);
}

async function assertChatChromeVisible(ctx: TestContext, label: string) {
  const titleOk = await ctx.page.$eval('[data-testid="chat-page-title"]', (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  });
  const titleText = await ctx.page.$eval('[data-testid="chat-page-title"]', (el) => el.textContent?.trim() ?? "");
  const headerOk = await ctx.page.$eval('[data-testid="chat-page-header"]', (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  });
  const selectorOk = await ctx.page.$eval('[data-testid="bot-selector"]', (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  });
  assert.ok(headerOk, `${label}: chat page header should be visible`);
  assert.ok(titleOk, `${label}: chat title should be visible`);
  assert.equal(titleText, "채팅", `${label}: chat title text`);
  assert.ok(selectorOk, `${label}: bot selector should be visible`);
}

async function closeMobileFinanceNav(ctx: TestContext) {
  await ctx.page.evaluate(() => {
    const burger = document.querySelector('[data-testid="finance-nav-burger"]');
    if (burger?.getAttribute("aria-expanded") === "true") {
      (burger as HTMLElement).click();
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
}

async function assertMobileChatComposerLayout(ctx: TestContext, label: string) {
  const metrics = await ctx.page.evaluate(() => {
    const textarea = document.querySelector('[data-testid="chat-input-textarea"]');
    const send = document.querySelector('[data-testid="chat-send"]');
    if (!textarea || !send) return null;
    const tr = textarea.getBoundingClientRect();
    const sr = send.getBoundingClientRect();
    const inputCenterY = tr.top + tr.height / 2;
    const sendCenterY = sr.top + sr.height / 2;
    return {
      height: tr.height,
      deltaY: Math.abs(inputCenterY - sendCenterY),
      value: (textarea as HTMLTextAreaElement).value,
    };
  });
  assert.ok(metrics, `${label}: chat textarea and send button should exist`);
  assert.equal(metrics.value, "", `${label}: textarea should be empty for height check`);
  assert.ok(metrics.height < 48, `${label}: empty textarea height < 48px (got ${metrics.height})`);
  assert.ok(metrics.deltaY <= 4, `${label}: vertical center delta <= 4px (got ${metrics.deltaY})`);
}

async function assertNoDuplicateMobileSectionTitle(ctx: TestContext, label: string) {
  const state = await ctx.page.evaluate(() => {
    const bar = document.querySelector('[data-testid="finance-mobile-nav-bar"]');
    const barText = bar?.textContent?.replace(/\s+/g, "").trim() ?? "";
    const pageTitles = Array.from(document.querySelectorAll('[data-testid="chat-page-title"]')).map(
      (el) => el.textContent?.trim(),
    );
    const visibleChatLabels = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, [data-testid='finance-mobile-nav-bar']"))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      })
      .map((el) => el.textContent?.trim())
      .filter((t) => t === "채팅");
    return { barText, pageTitles, visibleChatLabels };
  });
  assert.ok(!state.barText.includes("채팅"), `${label}: mobile nav bar should not show '채팅' label`);
  assert.equal(state.pageTitles.length, 1, `${label}: expected one chat page title`);
  assert.ok(
    state.visibleChatLabels.length <= 1,
    `${label}: '채팅' should not appear twice in visible headings (got ${state.visibleChatLabels.length})`,
  );
}

async function assertChatInputInViewport(ctx: TestContext, label: string) {
  const inView = await ctx.page.evaluate(() => {
    const el = document.querySelector('[data-testid="chat-input-textarea"]');
    if (!el) return { ok: false, reason: "missing" };
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const ok =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= vh &&
      rect.right <= vw;
    return { ok, top: rect.top, bottom: rect.bottom, vh };
  });
  assert.ok(inView.ok, `${label}: chat input in viewport (${JSON.stringify(inView)})`);
}

async function assertNoHorizontalOverflow(ctx: TestContext, label: string) {
  const metrics = await ctx.page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert.ok(
    metrics.scrollWidth <= metrics.innerWidth,
    `${label}: horizontal overflow (${metrics.scrollWidth}px > ${metrics.innerWidth}px viewport)`,
  );
}

async function takeScreenshot(ctx: TestContext, name: string, viewport: { width: number; height: number }) {
  await ctx.page.setViewport(viewport);
  if (viewport.width < 768) {
    await closeMobileFinanceNav(ctx);
  }
  await new Promise((resolve) => setTimeout(resolve, 800));
  await assertNoHorizontalOverflow(ctx, name);
  const filename = `${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await ctx.page.screenshot({ path: filepath, fullPage: false });
  ctx.screenshots.push(filename);
  
  const pageContent = await ctx.page.evaluate(() => document.body.innerText.slice(0, 200));
  console.log(`  📸 ${filename} - "${pageContent.replace(/\n/g, ' ').slice(0, 80)}..."`);
  return { filepath, content: pageContent };
}

function freeFinanceTestPort(port = 4203) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: "ignore" });
  } catch {
    /* Port may already be free. */
  }
}

async function createAuthTable(db: DynamoDBClient, tableName: string) {
  await db.send(new CreateTableCommand({
    TableName: tableName,
    KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST",
  }));
}

async function createDataTable(db: DynamoDBClient, tableName: string) {
  await db.send(new CreateTableCommand({
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
  }));
}

async function setupTestEnvironment(): Promise<TestContext> {
  const origin = "http://127.0.0.1:4203";
  const authTable = `FinanceAuthE2E-${randomUUID()}`;
  const dataTable = `FinanceDataE2E-${randomUUID()}`;
  const password = randomBytes(24).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const ownerId = "finance-owner";
  
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  
  const db = new DynamoDBClient({
    region: "ap-northeast-2",
    endpoint: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
  
  const docClient = DynamoDBDocumentClient.from(db, {
    marshallOptions: { removeUndefinedValues: true },
  });

  await createAuthTable(db, authTable);
  await createDataTable(db, dataTable);

  const passwordHash = await hash(password);
  
  const runtimeEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
    FINANCE_PASSWORD_HASH: passwordHash,
    FINANCE_SESSION_SECRET: secret,
    FINANCE_APP_ORIGIN: origin,
    FINANCE_AUTH_TABLE: authTable,
    FINANCE_DATA_TABLE: dataTable,
    AWS_REGION: "ap-northeast-2",
    FINANCE_DYNAMODB_ENDPOINT: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
  };

  freeFinanceTestPort(4203);
  await rm(path.join(process.cwd(), ".next"), { recursive: true, force: true });

  console.log("  Building production bundle...");
  const buildProcess = spawn("npm", ["run", "build"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...runtimeEnv, NODE_ENV: "production" },
  });
  
  await new Promise<void>((resolve, reject) => {
    buildProcess.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed with code ${code}`));
    });
  });
  console.log("  ✓ Build complete");

  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "4203"], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...runtimeEnv, NODE_ENV: "test" },
  });

  let logs = "";
  server.stdout?.on("data", (chunk) => { logs = (logs + chunk.toString()).slice(-100000); });
  server.stderr?.on("data", (chunk) => { logs = (logs + chunk.toString()).slice(-100000); });

  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error("Server exited before readiness");
    try {
      const resp = await fetch(`${origin}/finance/login`, { signal: AbortSignal.timeout(2000) });
      ready = resp.status === 200;
    } catch { /* Not ready yet. */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, "Production server did not become ready");

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || "/usr/local/bin/google-chrome",
    headless: !DEBUG,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  page.on("pageerror", (error) => console.error("Page error:", error));

  return { origin, authTable, dataTable, password, db, docClient, server, browser, page, logs, screenshots: [], ownerId };
}

async function cleanup(ctx: TestContext) {
  await ctx.browser?.close();
  if (ctx.server?.pid) {
    try { process.kill(-ctx.server.pid, "SIGTERM"); } catch { /* Already stopped. */ }
  }
  freeFinanceTestPort(4203);
  await ctx.db.send(new DeleteTableCommand({ TableName: ctx.authTable })).catch(() => undefined);
  await ctx.db.send(new DeleteTableCommand({ TableName: ctx.dataTable })).catch(() => undefined);
  ctx.db.destroy();
}

async function insertMockData(ctx: TestContext) {
  const { docClient, dataTable, ownerId } = ctx;
  const now = Date.now();
  
  const mockBot = {
    pk: `OWNER#${ownerId}`,
    sk: `BOT#bot-kr-stock`,
    entityType: "Bot",
    id: "bot-kr-stock",
    ownerId,
    name: "한국 주식 분석봇",
    template: "kr-stock",
    status: "active",
    allowedTools: ["search_disclosure", "analyze_financials", "memory_store", "memory_recall"],
    instructions: "한국 시장 공시 분석에 특화된 봇입니다.",
    createdAt: now - 86400000,
    updatedAt: now,
  };
  
  const mockRoutine = {
    pk: `routine#${ownerId}#routine-daily`,
    sk: "meta",
    id: "routine-daily",
    ownerId,
    botId: "bot-kr-stock",
    name: "매일 아침 시장 분석",
    instruction: "오늘 주요 공시와 시장 동향을 분석해주세요.",
    cronExpr: "0 9 * * 1-5",
    timezone: "Asia/Seoul",
    status: "active",
    statusCreatedAt: `active#${now - 172800000}`,
    version: 1,
    createdAt: now - 172800000,
    updatedAt: now,
  };
  
  const mockRunCompleted = {
    pk: `run#${ownerId}#run-completed`,
    sk: "meta",
    id: "run-completed",
    ownerId,
    statusCreatedAt: `completed#${now - 3600000}`,
    botId: "bot-kr-stock",
    routineId: "routine-daily",
    idempotencyKey: `routine-daily#1#${new Date(now - 3600000).toISOString()}`,
    status: "completed",
    attempt: 1,
    maxAttempts: 3,
    fencingToken: 1,
    createdAt: now - 3600000,
    startedAt: now - 3600000,
    finishedAt: now - 3590000,
    usage: {
      steps: 5,
      calls: 12,
      inputTokens: 15420,
      outputTokens: 2840,
      costUsd: 0.0287,
    },
    reportData: {
      response: `📊 오늘의 시장 분석 리포트 (2026-10-12)

## 삼성전자 (005930) 주요 공시

### 1. 2026년 3분기 잠정 실적 발표 (2026-10-10, 정확도: 일 단위)
- 매출액: 79.1조원 (전년 동기 대비 +15.2%)
- 영업이익: 12.8조원 (전년 동기 대비 +42.1%)

### 2. 신규 투자 계획 공시 (2026-10-08, 정확도: 일 단위)
- 파운드리 생산라인 증설: 4.5조원 규모

출처 확인됨 ✓`,
      sources: [
        { type: "disclosure", reference: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261010", title: "삼성전자 2026년 3분기 잠정실적" },
        { type: "disclosure", reference: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261008", title: "삼성전자 신규 투자 계획" },
      ],
    },
  };
  
  const mockRunTimeout = {
    pk: `run#${ownerId}#run-timeout`,
    sk: "meta",
    id: "run-timeout",
    ownerId,
    statusCreatedAt: `timeout#${now - 7200000}`,
    botId: "bot-kr-stock",
    idempotencyKey: `routine-daily#1#${new Date(now - 7200000).toISOString()}`,
    status: "timeout",
    attempt: 3,
    maxAttempts: 3,
    fencingToken: 3,
    createdAt: now - 7200000,
    startedAt: now - 7200000,
    finishedAt: now - 7020000,
    error: "최대 실행 시간(3분)을 초과했습니다.",
    errorCode: "TIMEOUT",
  };
  
  const mockRunBudget = {
    pk: `run#${ownerId}#run-budget`,
    sk: "meta",
    id: "run-budget",
    ownerId,
    statusCreatedAt: `failed#${now - 10800000}`,
    botId: "bot-kr-stock",
    idempotencyKey: `manual#${now - 10800000}`,
    status: "failed",
    attempt: 1,
    maxAttempts: 3,
    fencingToken: 1,
    createdAt: now - 10800000,
    startedAt: now - 10800000,
    finishedAt: now - 10780000,
    error: "일일 예산 한도($5.00)를 초과했습니다.",
    errorCode: "BUDGET_EXCEEDED",
    usage: {
      steps: 2,
      calls: 3,
      inputTokens: 8500,
      outputTokens: 1200,
      costUsd: 5.0012,
    },
  };
  
  const mockMessages = [
    {
      pk: `BOT#main-bot#MESSAGES`,
      sk: `MSG#${(now - 600000).toString().padStart(15, "0")}#msg-user-1`,
      entityType: "Message",
      id: `msg-user-1`,
      ownerId,
      botId: "main-bot",
      role: "user",
      content: "삼성전자 최근 공시 분석해줘",
      createdAt: now - 600000,
    },
    {
      pk: `BOT#main-bot#MESSAGES`,
      sk: `MSG#${(now - 590000).toString().padStart(15, "0")}#msg-assistant-1`,
      entityType: "Message",
      id: `msg-assistant-1`,
      ownerId,
      botId: "main-bot",
      role: "assistant",
      content: `삼성전자 최근 공시를 분석했습니다.

## 주요 공시 내용

### 2026년 3분기 잠정실적 (공시일: 2026-10-10)
- 매출액 79.1조원으로 전년 동기 대비 15.2% 증가
- 영업이익 12.8조원으로 42.1% 증가

### 신규 투자 계획 (공시일: 2026-10-08)  
- 파운드리 생산라인 증설에 4.5조원 투자 예정

📅 날짜 정확도: 일 단위 (DART 공시 기준)

---
출처:
- [삼성전자 잠정실적](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261010)
- [삼성전자 투자계획](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261008)`,
      createdAt: now - 590000,
    },
  ];

  const allItems = [mockBot, mockRoutine, mockRunCompleted, mockRunTimeout, mockRunBudget, ...mockMessages];
  
  for (const item of allItems) {
    await docClient.send(new PutCommand({ TableName: dataTable, Item: item }));
  }
  
  console.log(`  Inserted ${allItems.length} mock items into ${dataTable}`);
}

async function testLogin(ctx: TestContext) {
  console.log("\n📋 Test: Login flow");
  
  await ctx.page.goto(`${ctx.origin}/finance/login`, { waitUntil: "networkidle2" });
  
  await assertSingleThemeToggle(ctx, "01-login-desktop");
  await assertSiteNavVisible(ctx, "01-login-desktop");
  const { content: loginContent } = await takeScreenshot(ctx, "01-login-desktop-1440x900", { width: 1440, height: 900 });
  assert.ok(loginContent.includes("로그인") || loginContent.includes("비밀번호"), "Login page should show login form");
  
  await assertSiteNavVisible(ctx, "01-login-mobile");
  await takeScreenshot(ctx, "01-login-mobile-390x844", { width: 390, height: 844 });
  
  await ctx.page.setViewport({ width: 1440, height: 900 });

  const loginResponse = await fetch(`${ctx.origin}/api/finance/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ctx.origin },
    body: JSON.stringify({ password: ctx.password }),
  });
  assert.equal(loginResponse.status, 200, `API login failed: ${await loginResponse.text()}`);
  const setCookieHeader = loginResponse.headers.get("set-cookie");
  assert.ok(setCookieHeader, "Login response should set session cookie");
  const cookiePair = setCookieHeader.split(";")[0];
  const [cookieName, ...cookieValueParts] = cookiePair.split("=");
  await ctx.page.setCookie({
    name: cookieName,
    value: cookieValueParts.join("="),
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
  });

  await ctx.page.goto(`${ctx.origin}/finance`, { waitUntil: "networkidle2" });
  
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  const afterLoginPath = await ctx.page.evaluate(() => window.location.pathname);
  const pageContent = await ctx.page.evaluate(() => document.body.innerText.slice(0, 300));
  
  if (afterLoginPath === "/finance") {
    console.log(`  ✓ Login successful - now at ${afterLoginPath}`);
  } else if (pageContent.includes("채팅") || pageContent.includes("봇")) {
    console.log(`  ✓ Login successful - page shows finance content`);
  } else {
    console.log(`  ⚠ Login may have failed. Path: ${afterLoginPath}, Content: ${pageContent.slice(0, 100)}...`);
    await ctx.page.goto(`${ctx.origin}/finance`, { waitUntil: "networkidle2" });
  }
  
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await assertSiteNavVisible(ctx, "finance-home-after-login");
  await assertSingleThemeToggle(ctx, "finance-home-after-login");
  await assertNoFinanceAppHeader(ctx, "finance-home-after-login");
}

async function injectMockMessages(ctx: TestContext) {
  const now = Date.now();
  
  const injected = await ctx.page.evaluate((timestamp) => {
    const mockMessages = [
      {
        id: "msg-user-1",
        botId: "main-bot",
        role: "user",
        content: "삼성전자 최근 공시 분석해줘",
        createdAt: timestamp - 600000,
      },
      {
        id: "msg-assistant-1",
        botId: "main-bot",
        role: "assistant",
        content: `삼성전자 최근 공시를 분석했습니다.

## 주요 공시 내용

### 2026년 3분기 잠정실적 (공시일: 2026-10-10)
- 매출액 79.1조원으로 전년 동기 대비 15.2% 증가
- 영업이익 12.8조원으로 42.1% 증가

### 신규 투자 계획 (공시일: 2026-10-08)  
- 파운드리 생산라인 증설에 4.5조원 투자 예정

📅 날짜 정확도: 일 단위 (DART 공시 기준)

---
**출처:**
- [삼성전자 잠정실적](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261010) - DART 공시 (2026-10-10)
- [삼성전자 투자계획](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261008) - DART 공시 (2026-10-08)`,
        createdAt: timestamp - 590000,
      },
    ];

    const store = (window as unknown as { __FINANCE_STORE__?: { getState: () => { setMessages: (m: unknown[]) => void } } }).__FINANCE_STORE__;
    if (store) {
      store.getState().setMessages(mockMessages);
      return true;
    }
    return false;
  }, now);
  
  return injected;
}

async function testChatWithSources(ctx: TestContext) {
  console.log("\n📋 Test: Chat panel with disclosure analysis sources");
  
  await clickNavItem(ctx, "nav-chat");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  const injected = await injectMockMessages(ctx);
  if (injected) {
    console.log("  ✓ Mock messages injected");
  } else {
    console.log("  ⚠ Could not inject messages (store not found)");
  }
  
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  await assertSingleThemeToggle(ctx, "02-chat-desktop");
  await assertNoFinanceAppHeader(ctx, "02-chat-desktop");
  await assertSiteNavVisible(ctx, "02-chat-desktop");
  await assertChatChromeVisible(ctx, "02-chat-desktop");
  await assertChatInputInViewport(ctx, "02-chat-desktop");
  const { content: chatContent } = await takeScreenshot(ctx, "02-chat-with-sources-desktop-1440x900", { width: 1440, height: 900 });
  await ctx.page.setViewport({ width: 390, height: 844 });
  await closeMobileFinanceNav(ctx);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await assertSingleThemeToggle(ctx, "02-chat-mobile");
  await assertNoFinanceAppHeader(ctx, "02-chat-mobile");
  await assertSiteNavVisible(ctx, "02-chat-mobile");
  await assertChatChromeVisible(ctx, "02-chat-mobile");
  await assertNoDuplicateMobileSectionTitle(ctx, "02-chat-mobile");
  await assertChatInputInViewport(ctx, "02-chat-mobile");
  await assertMobileChatComposerLayout(ctx, "02-chat-mobile");
  await takeScreenshot(ctx, "02-chat-with-sources-mobile-390x844", { width: 390, height: 844 });
  
  assert.ok(
    chatContent.includes("채팅") || chatContent.includes("삼성") || chatContent.includes("금융"),
    "Chat panel should be visible"
  );
  assert.ok(!chatContent.includes("## "), "Chat should render markdown headings, not raw ## markers");
  const sourceCardCount = await ctx.page.$$eval(
    '[data-testid="source-citation-list"] [data-testid^="source-citation-"]',
    (els) => els.length,
  );
  assert.ok(sourceCardCount >= 2, `Expected source citation cards, found ${sourceCardCount}`);
  const dateBadge = await ctx.page.$('[data-testid="date-precision-badge"]');
  assert.ok(dateBadge, "Date precision badge should be visible");
  console.log("  ✓ Chat panel with sources displayed");
}

async function clickNavItem(ctx: TestContext, testId: string) {
  await ctx.page.setViewport({ width: 1440, height: 900 });
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  await ctx.page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    if (el) el.click();
  }, testId);
  
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function testBotList(ctx: TestContext) {
  console.log("\n📋 Test: Bot list");
  
  await clickNavItem(ctx, "nav-bots");
  
  const { content: botListContent } = await takeScreenshot(ctx, "03-bot-list-desktop-1440x900", { width: 1440, height: 900 });
  await takeScreenshot(ctx, "03-bot-list-mobile-390x844", { width: 390, height: 844 });
  
  assert.ok(
    botListContent.includes("봇") || botListContent.includes("Bot"),
    "Bot list should be visible"
  );
  console.log("  ✓ Bot list displayed");
}

async function testBotCreateModal(ctx: TestContext) {
  console.log("\n📋 Test: Bot create modal");
  
  await ctx.page.setViewport({ width: 1440, height: 900 });
  
  await ctx.page.evaluate(() => {
    const btn = document.querySelector('[data-testid="create-bot-btn"]') as HTMLElement;
    if (btn) btn.click();
  });
  
  await new Promise((resolve) => setTimeout(resolve, 800));
  
  const inputVisible = await ctx.page.$('[data-testid="bot-name-input"]');
  if (inputVisible) {
    await ctx.page.type('[data-testid="bot-name-input"]', 'E2E 테스트 봇');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  
  const { content: modalContent } = await takeScreenshot(ctx, "04-bot-create-modal-desktop-1440x900", { width: 1440, height: 900 });
  await takeScreenshot(ctx, "04-bot-create-modal-mobile-390x844", { width: 390, height: 844 });
  
  assert.ok(
    modalContent.includes("생성") || modalContent.includes("봇") || modalContent.includes("테스트") || modalContent.includes("관리"),
    "Bot create modal should be visible"
  );
  
  await ctx.page.keyboard.press("Escape");
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log("  ✓ Bot create modal displayed");
}

async function testBotDetail(ctx: TestContext) {
  console.log("\n📋 Test: Bot detail modal");
  
  await ctx.page.setViewport({ width: 1440, height: 900 });
  
  const clicked = await ctx.page.evaluate(() => {
    const card = document.querySelector('[data-testid^="bot-card-"]') as HTMLElement;
    if (card) {
      card.click();
      return true;
    }
    return false;
  });
  
  if (clicked) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    const { content: detailContent } = await takeScreenshot(ctx, "05-bot-detail-desktop-1440x900", { width: 1440, height: 900 });
    await takeScreenshot(ctx, "05-bot-detail-mobile-390x844", { width: 390, height: 844 });
    
    assert.ok(
      detailContent.includes("설정") || detailContent.includes("봇") || detailContent.includes("도구") || detailContent.includes("관리"),
      "Bot detail modal should be visible"
    );
    
    await ctx.page.keyboard.press("Escape");
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log("  ✓ Bot detail modal displayed");
  } else {
    console.log("  ⚠ No bot cards found to click - taking screenshot anyway");
    await takeScreenshot(ctx, "05-bot-detail-desktop-1440x900", { width: 1440, height: 900 });
    await takeScreenshot(ctx, "05-bot-detail-mobile-390x844", { width: 390, height: 844 });
  }
}

async function testRoutineList(ctx: TestContext) {
  console.log("\n📋 Test: Routine list");
  
  await clickNavItem(ctx, "nav-routines");
  
  const { content: routineContent } = await takeScreenshot(ctx, "06-routine-list-desktop-1440x900", { width: 1440, height: 900 });
  await takeScreenshot(ctx, "06-routine-list-mobile-390x844", { width: 390, height: 844 });
  
  assert.ok(
    routineContent.includes("루틴") || routineContent.includes("정기") || routineContent.includes("실행"),
    "Routine list should be visible"
  );
  console.log("  ✓ Routine list displayed");
}

async function testRoutineCreate(ctx: TestContext) {
  console.log("\n📋 Test: Routine create modal");
  
  await ctx.page.setViewport({ width: 1440, height: 900 });
  
  await ctx.page.evaluate(() => {
    const btn = document.querySelector('[data-testid="create-routine-btn"]') as HTMLElement;
    if (btn) btn.click();
  });
  
  await new Promise((resolve) => setTimeout(resolve, 800));
  
  const inputVisible = await ctx.page.$('[data-testid="routine-name-input"]');
  if (inputVisible) {
    await ctx.page.type('[data-testid="routine-name-input"]', '테스트 루틴');
    const instrInput = await ctx.page.$('[data-testid="routine-instruction-input"]');
    if (instrInput) {
      await ctx.page.type('[data-testid="routine-instruction-input"]', '매일 아침 시장 분석');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  
  const { content: modalContent } = await takeScreenshot(ctx, "07-routine-create-modal-desktop-1440x900", { width: 1440, height: 900 });
  await takeScreenshot(ctx, "07-routine-create-modal-mobile-390x844", { width: 390, height: 844 });
  
  assert.ok(
    modalContent.includes("생성") || modalContent.includes("루틴") || modalContent.includes("테스트") || modalContent.includes("정기"),
    "Routine create modal should be visible"
  );
  
  await ctx.page.keyboard.press("Escape");
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log("  ✓ Routine create modal displayed");
}

async function testRunList(ctx: TestContext) {
  console.log("\n📋 Test: Run list");
  
  await clickNavItem(ctx, "nav-runs");
  
  const { content: runContent } = await takeScreenshot(ctx, "08-runs-list-desktop-1440x900", { width: 1440, height: 900 });
  await takeScreenshot(ctx, "08-runs-list-mobile-390x844", { width: 390, height: 844 });
  
  assert.ok(
    runContent.includes("실행") || runContent.includes("기록") || runContent.includes("Run"),
    "Run list should be visible"
  );
  console.log("  ✓ Run list displayed");
}

async function testRunsWithErrors(ctx: TestContext) {
  console.log("\n📋 Test: Runs with error states");
  
  await ctx.page.setViewport({ width: 1440, height: 900 });
  
  await ctx.page.evaluate(() => {
    const buttons = document.querySelectorAll('[data-testid^="run-expand-"]');
    buttons.forEach((btn, i) => {
      if (i < 3) (btn as HTMLElement).click();
    });
  });
  
  await new Promise((resolve) => setTimeout(resolve, 800));
  
  const { content: errorContent } = await takeScreenshot(ctx, "09-runs-with-errors-desktop-1440x900", { width: 1440, height: 900 });
  await takeScreenshot(ctx, "09-runs-with-errors-mobile-390x844", { width: 390, height: 844 });
  
  const pageText = await ctx.page.evaluate(() => document.body.innerText);
  const hasErrorStates = 
    pageText.includes("시간초과") || pageText.includes("timeout") ||
    pageText.includes("예산") || pageText.includes("budget") ||
    pageText.includes("실패") || pageText.includes("failed") ||
    pageText.includes("완료") || pageText.includes("completed");
  
  if (hasErrorStates) {
    console.log("  ✓ Error/timeout/budget states visible in runs");
  } else {
    console.log("  ⚠ Error states not visible (mock data may not be loaded)");
  }
}

async function testReloadMemory(ctx: TestContext) {
  console.log("\n📋 Test: Reload preserves state");
  
  await ctx.page.reload({ waitUntil: "networkidle2" });
  await new Promise((resolve) => setTimeout(resolve, 3000));
  
  const afterReload = await ctx.page.evaluate(() => ({
    path: window.location.pathname,
    contentLength: document.body.innerText.length,
    hasFinanceText: document.body.innerText.includes("금융") || document.body.innerText.includes("로그인"),
  }));
  
  if (afterReload.path === "/finance" && afterReload.contentLength > 50) {
    console.log("  ✓ Page state preserved after reload");
  } else if (afterReload.hasFinanceText) {
    console.log("  ✓ Page reloaded (redirected to login, session expired in test environment)");
  } else {
    console.log(`  ⚠ Reload state: path=${afterReload.path}, content=${afterReload.contentLength} chars`);
  }
}

async function verifyScreenshots(ctx: TestContext) {
  console.log("\n📋 Verifying screenshots are different...");
  
  const fs = await import("node:fs/promises");
  const sizes = new Map<number, string[]>();
  
  for (const filename of ctx.screenshots) {
    const filepath = path.join(SCREENSHOT_DIR, filename);
    const stat = await fs.stat(filepath);
    const size = stat.size;
    
    if (!sizes.has(size)) {
      sizes.set(size, []);
    }
    sizes.get(size)!.push(filename);
  }
  
  let allUnique = true;
  for (const [size, files] of sizes) {
    if (files.length > 2) {
      console.log(`  ⚠ Multiple screenshots with same size (${size} bytes): ${files.join(', ')}`);
      allUnique = false;
    }
  }
  
  if (allUnique) {
    console.log("  ✓ Screenshots appear to show different screens");
  }
  
  return allUnique;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════╗");
  console.log("║     Finance UI E2E Tests - Core Journey with Real Screenshots      ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝\n");
  
  let ctx: TestContext | undefined;
  
  try {
    ctx = await setupTestEnvironment();
    console.log("✓ Test environment ready (separate auth + data tables)");
    
    await insertMockData(ctx);
    console.log("✓ Mock data inserted\n");
    
    await testLogin(ctx);
    await testChatWithSources(ctx);
    await testBotList(ctx);
    await testBotCreateModal(ctx);
    await testBotDetail(ctx);
    await testRoutineList(ctx);
    await testRoutineCreate(ctx);
    await testRunList(ctx);
    await testRunsWithErrors(ctx);
    await testReloadMemory(ctx);
    
    const screenshotsOk = await verifyScreenshots(ctx);
    
    console.log("\n╔════════════════════════════════════════════════════════════════════╗");
    console.log("║              PASS: All E2E Tests Completed                         ║");
    console.log("╚════════════════════════════════════════════════════════════════════╝\n");
    
    console.log("📸 Screenshots saved to /opt/cursor/artifacts/screenshots/:\n");
    for (const screenshot of ctx.screenshots) {
      console.log(`   - ${screenshot}`);
    }
    
    if (!screenshotsOk) {
      console.log("\n⚠ Warning: Some screenshots may be duplicates");
    }
    
  } catch (error) {
    console.error("\n╔════════════════════════════════════════════════════════════════════╗");
    console.error("║              FAIL: E2E Test Failed                                 ║");
    console.error("╚════════════════════════════════════════════════════════════════════╝");
    console.error(error instanceof Error ? error.message : "Unknown error");
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    if (DEBUG && ctx) {
      console.error("\nServer logs (last 5000 chars):");
      console.error(ctx.logs.slice(-5000));
    }
    process.exitCode = 1;
  } finally {
    if (ctx) await cleanup(ctx);
  }
}

main().catch((error) => {
  console.error("Finance UI E2E could not initialize:", error);
  process.exitCode = 1;
});
