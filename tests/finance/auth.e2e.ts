import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import puppeteer from "puppeteer-core";

async function main() {
  const origin = "http://127.0.0.1:4201";
  const table = `FinanceAuthE2E-${randomUUID()}`;
  const password = randomBytes(24).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const db = new DynamoDBClient({ region: "ap-northeast-2", endpoint: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000", credentials: { accessKeyId: "local", secretAccessKey: "local" } });
  await db.send(new CreateTableCommand({ TableName: table, KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }], AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }], BillingMode: "PAY_PER_REQUEST" }));
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--turbopack", "-p", "4201"], {
    detached: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", FINANCE_PASSWORD_HASH: await hash(password), FINANCE_SESSION_SECRET: secret, FINANCE_APP_ORIGIN: origin, FINANCE_AUTH_TABLE: table, AWS_REGION: "ap-northeast-2", FINANCE_DYNAMODB_ENDPOINT: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000" },
  });
  let logs = "";
  server.stdout.on("data", (chunk) => { logs = (logs + chunk.toString()).slice(-100000); });
  server.stderr.on("data", (chunk) => { logs = (logs + chunk.toString()).slice(-100000); });
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    let ready = false;
    for (let i = 0; i < 120; i++) {
      if (server.exitCode !== null) throw new Error("Dev server exited before readiness");
      try { ready = (await fetch(`${origin}/finance/login`, { signal: AbortSignal.timeout(2000) })).status === 200; } catch { /* Not ready yet. */ }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, "Dev server did not become ready");
    assert.equal((await fetch(`${origin}/api/finance/auth/session`)).status, 401);
    assert.equal((await fetch(`${origin}/api/finance/bots`)).status, 401);
    const redirect = await fetch(`${origin}/finance`, { redirect: "manual" });
    assert.equal(redirect.status, 307);
    assert.equal(new URL(redirect.headers.get("location")!, origin).pathname, "/finance/login");
    assert.equal((await fetch(`${origin}/api/finance/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://attacker.example" }, body: JSON.stringify({ password }) })).status, 403);
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => { errors.push(String(error)); });
    await page.goto(`${origin}/finance/login`, { waitUntil: "networkidle2" });
    await page.type('input[name="password"]', "incorrect-password");
    await page.click('button[type="submit"]');
    await page.waitForSelector('[role="alert"]');
    assert.ok((await page.$eval('[role="alert"]', (element) => element.textContent))?.includes("비밀번호가 올바르지"));
    assert.equal((await page.$eval('input[name="password"]', (input) => (input as HTMLInputElement).value)), "");
    await page.type('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === "/finance");
    await page.waitForFunction(() => document.body.innerText.includes("금융 분석 기능은 준비 중"));
    const sessionCookie = (await browser.cookies()).find((cookie) => cookie.name === "finance-session-local");
    assert.ok(sessionCookie?.httpOnly);
    assert.equal(sessionCookie?.sameSite, "Strict");
    const sessionStatus = await page.evaluate(async () => (await fetch("/api/finance/auth/session")).status);
    assert.equal(sessionStatus, 200);
    const tokenCookie = `finance-session-local=${sessionCookie!.value}`;
    assert.equal((await fetch(`${origin}/api/finance/auth/session`, { headers: { Cookie: "finance-session-local=forged" } })).status, 401);
    assert.equal((await fetch(`${origin}/api/finance/auth/logout`, { method: "POST", headers: { Cookie: tokenCookie } })).status, 403);
    await page.evaluate(() => { (Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("로그아웃")) as HTMLButtonElement).click(); });
    await page.waitForFunction(() => window.location.pathname === "/finance/login");
    assert.ok(!(await browser.cookies()).some((cookie) => cookie.name === "finance-session-local"));
    assert.equal(await page.evaluate(async () => (await fetch("/api/finance/auth/session")).status), 401);
    // Two actual logins already consumed attempts; remaining requests exhaust the same persistent bucket.
    for (let i = 0; i < 3; i++) {
      assert.equal((await fetch(`${origin}/api/finance/auth/login`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Forwarded-For": `203.0.113.${i}` }, body: JSON.stringify({ password: "incorrect-password" }) })).status, 401);
    }
    const limited = await fetch(`${origin}/api/finance/auth/login`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.1" }, body: JSON.stringify({ password }) });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("Retry-After")) > 0);
    // Shared storage outage must close login even for a correct password.
    await db.send(new DeleteTableCommand({ TableName: table }));
    assert.equal((await fetch(`${origin}/api/finance/auth/login`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ password }) })).status, 503);
    for (const path of ["/", "/blog", "/blog/2026-01-05", "/ai"]) {
      const response = await fetch(`${origin}${path}`);
      assert.equal(response.status, 200, `Regression on ${path}`);
      assert.ok((await response.text()).includes("zakklee"));
    }
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${origin}/finance/login`, { waitUntil: "networkidle2" });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Mobile layout overflows");
    assert.deepEqual(errors, []);
    assert.ok(!logs.includes(password) && !logs.includes(secret), "Server logged credentials");
    console.log("PASS: browser login/error/logout, API guards/Origin/rate limit/outage, mobile layout and four existing pages.");
  } catch (error) {
    // Only synthetic credentials are used, but avoid printing them or whole server logs anyway.
    console.error("Finance auth E2E failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  } finally {
    await browser?.close();
    if (server.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* Already stopped. */ } }
    await db.send(new DeleteTableCommand({ TableName: table })).catch(() => undefined);
    db.destroy();
  }
}

main().catch(() => { console.error("Finance auth E2E could not initialize. Check local DynamoDB and Chromium."); process.exitCode = 1; });
