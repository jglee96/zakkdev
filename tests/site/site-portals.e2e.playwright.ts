/**
 * Site-wide portal / shell regression (Playwright).
 *
 *   npx tsx tests/site/site-portals.e2e.playwright.ts
 */

import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";
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
import { chromium, type Page, type ConsoleMessage } from "playwright";

const PORT = Number(process.env.SITE_E2E_PORT ?? "4220");
const ORIGIN = `http://127.0.0.1:${PORT}`;

const PUBLIC_ROUTES = [
  { path: "/", name: "home" },
  { path: "/projects", name: "projects" },
  { path: "/blog", name: "blog-list" },
  { path: "/blog/2026-06-18-hawaiian", name: "blog-post" },
  { path: "/ai", name: "ai" },
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const CONSOLE_IGNORE =
  /favicon|\.map$|chrome-extension|DevTools|Failed to load resource.*404|ERR_BLOCKED_BY|network error/i;

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

function attachConsoleCollector(page: Page) {
  const errors: string[] = [];
  const onConsole = (msg: ConsoleMessage) => {
    const type = msg.type();
    const text = msg.text();
    if (type === "error" && !CONSOLE_IGNORE.test(text)) {
      errors.push(text);
    }
    if (type === "warning" && /hydration|Hydration/i.test(text)) {
      errors.push(`hydration-warning: ${text}`);
    }
  };
  page.on("console", onConsole);
  return {
    drain: () => {
      page.off("console", onConsole);
      return errors;
    },
  };
}

async function setColorScheme(page: Page, scheme: "light" | "dark") {
  const current = await page.evaluate(() =>
    document.documentElement.getAttribute("data-mantine-color-scheme"),
  );
  if (current === scheme) return;
  await page.locator('[data-testid="site-theme-toggle"]').click();
  await page.waitForFunction(
    (expected) => document.documentElement.getAttribute("data-mantine-color-scheme") === expected,
    scheme,
    { timeout: 5000 },
  );
}

async function seedFinanceBot(dataTable: string, ownerId: string) {
  const doc = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: "ap-northeast-2",
      endpoint: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
      credentials: { accessKeyId: "local", secretAccessKey: "local" },
    }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
  const now = Date.now();
  await doc.send(
    new PutCommand({
      TableName: dataTable,
      Item: {
        pk: `OWNER#${ownerId}`,
        sk: "BOT#bot-e2e",
        entityType: "Bot",
        id: "bot-e2e",
        ownerId,
        name: "E2E 봇",
        template: "kr-stock",
        status: "active",
        allowedTools: ["search_dart_filings"],
        instructions: "테스트",
        createdAt: now,
        updatedAt: now,
      },
    }),
  );
}

async function loginFinance(page: Page, password: string) {
  const loginResponse = await fetch(`${ORIGIN}/api/finance/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ password }),
  });
  assert.equal(loginResponse.status, 200, await loginResponse.text());
  const setCookieHeader = loginResponse.headers.get("set-cookie");
  assert.ok(setCookieHeader);
  const cookiePair = setCookieHeader.split(";")[0];
  const eq = cookiePair.indexOf("=");
  await page.context().addCookies([
    {
      name: cookiePair.slice(0, eq),
      value: cookiePair.slice(eq + 1),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
    },
  ]);
}

async function assertShellRoots(page: Page) {
  const roots = await page.evaluate(() => {
    const appRoot = document.getElementById("app-root");
    const modalRoot = document.getElementById("modal-root");
    return {
      appRoot: Boolean(appRoot),
      modalRoot: Boolean(modalRoot),
      appRootParent: appRoot?.parentElement?.tagName.toLowerCase() ?? null,
      modalRootParent: modalRoot?.parentElement?.tagName.toLowerCase() ?? null,
      appRootBeforeModalRoot:
        Boolean(appRoot && modalRoot) &&
        Boolean(appRoot.compareDocumentPosition(modalRoot) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  assert.ok(roots.appRoot && roots.modalRoot, "app-root and modal-root should exist");
  assert.equal(roots.appRootParent, "body", "app-root should be a direct child of body");
  assert.equal(roots.modalRootParent, "body", "modal-root should be a direct child of body");
  assert.ok(roots.appRootBeforeModalRoot, "app-root should precede modal-root in DOM");
}

async function assertSiteHeaderSticky(page: Page, label: string) {
  const header = await page.locator('[data-testid="site-app-shell-header"]');
  await header.waitFor({ state: "visible" });
  const position = await header.evaluate((el) => getComputedStyle(el).position);
  assert.equal(position, "fixed", `${label}: site header should be fixed`);
}

async function testPublicPages(page: Page) {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const scheme of ["light", "dark"] as const) {
      for (const route of PUBLIC_ROUTES) {
        const label = `${route.name}-${viewport.name}-${scheme}`;
        const collector = attachConsoleCollector(page);
        await page.goto(`${ORIGIN}${route.path}`, { waitUntil: "networkidle" });
        await setColorScheme(page, scheme);
        await assertShellRoots(page);
        await assertSiteHeaderSticky(page, label);
        await page.locator('[data-testid="site-nav-home"]').waitFor({ state: "visible" });
        const scrollOk = await page.evaluate(() => {
          const before = window.scrollY;
          window.scrollTo(0, 400);
          return window.scrollY > before || document.documentElement.scrollHeight <= window.innerHeight;
        });
        assert.ok(scrollOk, `${label}: page should scroll or fit viewport`);
        const errs = collector.drain();
        assert.equal(errs.length, 0, `${label}: console errors: ${errs.join("; ")}`);
        console.log(`  ✓ ${label}`);
      }
    }
  }
}

async function testBlogImageModal(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ORIGIN}/blog/2026-06-18-hawaiian`, { waitUntil: "networkidle" });
  await setColorScheme(page, "light");
  const img = page.locator("article img:visible, main img:visible").first();
  if (await img.count() === 0) {
    console.log("  ⚠ blog image modal skipped (no visible img)");
    return;
  }
  await img.scrollIntoViewIfNeeded();
  await img.click({ force: true });
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  const inModalRoot = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return Boolean(dialog && document.getElementById("modal-root")?.contains(dialog));
  });
  assert.ok(inModalRoot, "blog image modal should portal into #modal-root");
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 5000 });
  console.log("  ✓ blog image modal in #modal-root (dark)");
}

async function testFinancePortals(page: Page) {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const scheme of ["light", "dark"] as const) {
      const label = `finance-${viewport.name}-${scheme}`;
      await page.goto(`${ORIGIN}/finance`, { waitUntil: "networkidle" });
      await setColorScheme(page, scheme);

      await page.locator('[data-testid="bot-selector"]').click();
      await page.waitForSelector('[role="option"], .mantine-Combobox-option', { timeout: 8000 });
      const dropdownPortal = await page.evaluate(() => {
        const option = document.querySelector('[role="option"], .mantine-Combobox-option');
        const root = document.getElementById("modal-root");
        return Boolean(option && root && root.contains(option));
      });
      assert.ok(dropdownPortal, `${label}: bot selector dropdown should render in #modal-root`);
      await page.keyboard.press("Escape");

      if (viewport.width < 768) {
        await page.locator('[data-testid="finance-nav-burger"]').click();
        await page.waitForTimeout(400);
        const overlayHitsHeader = await page.evaluate(() => {
          const header = document.querySelector('[data-testid="site-app-shell-header"]');
          if (!header) return { ok: false, reason: "no-header" };
          const hr = header.getBoundingClientRect();
          const cx = hr.left + hr.width / 2;
          const cy = hr.top + hr.height / 2;
          const top = document.elementFromPoint(cx, cy);
          const overlay = document.querySelector('[data-testid="finance-mobile-nav-overlay"]');
          const inModalRoot = Boolean(
            overlay && document.getElementById("modal-root")?.contains(overlay),
          );
          return {
            ok: Boolean(inModalRoot && top && overlay && (top === overlay || overlay.contains(top))),
            topTag: top instanceof Element ? top.getAttribute("data-testid") : null,
          };
        });
        assert.ok(
          overlayHitsHeader.ok,
          `${label}: mobile AppShell overlay should cover site header (${JSON.stringify(overlayHitsHeader)})`,
        );
        await page.locator('[data-testid="finance-mobile-nav-drawer"] [data-testid="nav-bots"]').click();
        await page.waitForSelector('[data-testid="finance-mobile-nav-overlay"]', { state: "hidden", timeout: 5000 });
      } else {
        await page.locator('[data-testid="nav-bots"]').click();
      }
      await page.locator('[data-testid="create-bot-btn"]').click();
      await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

      const portalTheme = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const scheme = document.documentElement.getAttribute("data-mantine-color-scheme");
        const bg = dialog ? getComputedStyle(dialog).backgroundColor : "";
        return { scheme, bg, inModalRoot: document.getElementById("modal-root")?.contains(dialog ?? null) };
      });
      assert.ok(portalTheme.inModalRoot, `${label}: finance modal in #modal-root`);
      assert.equal(portalTheme.scheme, scheme, `${label}: color scheme on html should match`);

      const modalA11y = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const overlay = document.querySelector(".finance-modal-overlay, .mantine-Modal-overlay");
        const bodyStyle = getComputedStyle(document.body);
        const htmlStyle = getComputedStyle(document.documentElement);
        const scrollLocked =
          bodyStyle.overflow === "hidden" ||
          htmlStyle.overflow === "hidden" ||
          bodyStyle.paddingRight !== "" ||
          document.body.style.overflow === "hidden";
        return {
          ariaModal: dialog?.getAttribute("aria-modal"),
          overlayHeight: overlay?.getBoundingClientRect().height ?? 0,
          scrollLocked,
        };
      });
      assert.equal(modalA11y.ariaModal, "true", `${label}: dialog should be aria-modal`);
      assert.ok(modalA11y.overlayHeight > 0, `${label}: modal overlay should cover viewport`);

      const trigger = page.locator('[data-testid="create-bot-btn"]');
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      const focusInDialog = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return Boolean(dialog && dialog.contains(document.activeElement));
      });
      assert.ok(focusInDialog, `${label}: focus should remain inside dialog after Tab`);

      await page.keyboard.press("Escape");
      await page.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 8000 });
      await page.waitForTimeout(300);
      const focusReturned = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="create-bot-btn"]');
        if (!btn) return false;
        const active = document.activeElement;
        return active === btn || btn.contains(active) || active?.closest('[data-testid="create-bot-btn"]');
      });
      assert.ok(focusReturned, `${label}: focus should return near create button after Esc`);

      if (viewport.width >= 768) {
        await page.waitForSelector('[data-testid="bots-list"]', { timeout: 10000 });
        await page.locator('[data-testid="refresh-bots"]').hover();
        await page.waitForSelector('[role="tooltip"]', { timeout: 5000 });
        assert.ok(await page.locator('[role="tooltip"]').isVisible(), `${label}: tooltip on refresh button`);
      }

      console.log(`  ✓ ${label}`);
    }
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║        Site-wide portal & shell Playwright E2E                 ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const authTable = `FinanceAuthSite-${randomUUID()}`;
  const dataTable = `FinanceDataSite-${randomUUID()}`;
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
  const server = spawn(
    process.execPath,
    [path.join(process.cwd(), "node_modules/next/dist/bin/next"), "dev", "-p", String(PORT)],
    {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...runtimeEnv, NODE_ENV: "development" },
    },
  );

  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error("Dev server exited early");
    try {
      const resp = await fetch(`${ORIGIN}/`, { signal: AbortSignal.timeout(2000) });
      ready = resp.status === 200;
    } catch {
      /* retry */
    }
    if (ready) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready, "Dev server not ready");
  await new Promise((r) => setTimeout(r, 2000));

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();

  try {
    console.log("📋 Public site pages (light/dark, desktop/mobile)\n");
    await testPublicPages(page);

    console.log("\n📋 Blog image modal\n");
    await testBlogImageModal(page);

    console.log("\n📋 Finance portals\n");
    await seedFinanceBot(dataTable, "finance-owner");
    await loginFinance(page, password);
    await testFinancePortals(page);

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║                    PASS: Site portal E2E                     ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
  } finally {
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
