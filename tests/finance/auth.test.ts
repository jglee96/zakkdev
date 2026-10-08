import assert from "node:assert/strict";
import { before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { getAuthConfig, OWNER_ID, SESSION_SECONDS, type AuthConfig } from "../../shared/finance/auth/config";
import { createSession, sessionCookie, verifySession } from "../../shared/finance/auth/session";
import { handleLogin } from "../../shared/finance/auth/login";
import { getClientIdentity, createRateLimitClient } from "../../shared/finance/auth/rate-limit";
import { requireFinanceSession } from "../../shared/finance/auth/guard";
import { middleware } from "../../middleware";
import { POST as logout } from "../../app/api/finance/auth/logout/route";

const PASSWORD = "test-only-long-password";
let config: AuthConfig;
let env: NodeJS.ProcessEnv;
before(async () => {
  env = { NODE_ENV: "production", FINANCE_APP_ORIGIN: "https://finance.example.com", FINANCE_PASSWORD_HASH: await hash(PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 }), FINANCE_SESSION_SECRET: randomBytes(32).toString("base64url") };
  config = getAuthConfig(env);
});
const loginRequest = (password = PASSWORD, origin = "https://finance.example.com") => new Request(`${origin}/api/finance/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ password }) });
const allowed = { config: () => config, consume: async () => ({ allowed: true, retryAfter: 0 }) };

async function withEnv(fn: () => Promise<void>) {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try { await fn(); } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
}

test("configuration rejects missing credentials, weak secrets, bad hashes and unsafe deployed origins", () => {
  for (const overrides of [{ FINANCE_SESSION_SECRET: "" }, { FINANCE_SESSION_SECRET: "short" }, { FINANCE_PASSWORD_HASH: "plaintext" }, { FINANCE_APP_ORIGIN: "http://localhost:4200" }, { FINANCE_APP_ORIGIN: "https://finance.example.com/path" }, { FINANCE_APP_ORIGIN: "https://user@finance.example.com" }]) {
    assert.throws(() => getAuthConfig({ ...env, ...overrides }));
  }
  assert.throws(() => getAuthConfig({}));
  assert.equal(getAuthConfig({ ...env, NODE_ENV: "development", FINANCE_APP_ORIGIN: "http://localhost:4200" }).secure, false);
});

test("sessions reject tampering, expiration, future issue time, foreign owners and rotated signing keys", async () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const token = await createSession(config, now);
  assert.deepEqual(await verifySession(token, config, now), { ownerId: OWNER_ID, expiresAt: Math.floor(now.getTime() / 1000) + SESSION_SECONDS });
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ sub: "attacker" })).toString("base64url");
  assert.equal(await verifySession(parts.join("."), config, now), null);
  assert.equal(await verifySession(token, config, new Date(now.getTime() + SESSION_SECONDS * 1000)), null);
  assert.equal(await verifySession(token, config, new Date(now.getTime() - 1000)), null);
  assert.equal(await verifySession(token, { ...config, signingKey: randomBytes(32) }, now), null);
  const wrongOwner = await new SignJWT({}).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer("zakkdev-finance").setAudience("zakkdev-finance-owner").setSubject("attacker").setIssuedAt().setExpirationTime("8h").sign(config.signingKey);
  assert.equal(await verifySession(wrongOwner, config), null);
  const noExpiry = await new SignJWT({ sub: OWNER_ID }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).sign(config.signingKey);
  assert.equal(await verifySession(noExpiry, config), null);
});

test("valid login issues a private host cookie; incorrect password never issues a session", async () => {
  const success = await handleLogin(loginRequest(), allowed);
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("Cache-Control"), "no-store");
  const cookie = success.headers.get("Set-Cookie")!;
  for (const flag of ["__Host-finance-session=", "HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Max-Age=28800"]) assert.ok(cookie.includes(flag));
  assert.ok(!cookie.includes("Domain="));
  const body = await success.text();
  assert.ok(!body.includes(PASSWORD) && !body.includes(env.FINANCE_SESSION_SECRET!));
  const failure = await handleLogin(loginRequest("incorrect-password"), allowed);
  assert.equal(failure.status, 401);
  assert.equal(failure.headers.get("Set-Cookie"), null);
});

test("login rejects missing/foreign origins, invalid JSON, oversized streamed bodies and non-JSON without verification", async () => {
  let attempts = 0;
  const dependencies = { ...allowed, consume: async () => { attempts++; return { allowed: true, retryAfter: 0 }; } };
  for (const origin of [null, "https://attacker.example"]) {
    const request = loginRequest();
    if (origin) request.headers.set("Origin", origin); else request.headers.delete("Origin");
    assert.equal((await handleLogin(request, dependencies)).status, 403);
  }
  for (const body of ["not json", JSON.stringify({ password: "a".repeat(5000) }), JSON.stringify({ password: 123 }), "{}", JSON.stringify({ password: "" })]) {
    const request = new Request(config.origin, { method: "POST", headers: { Origin: config.origin, "Content-Type": "application/json", "Content-Length": "1" }, body });
    assert.equal((await handleLogin(request, dependencies)).status, 400);
  }
  const form = new Request(config.origin, { method: "POST", headers: { Origin: config.origin, "Content-Type": "application/x-www-form-urlencoded" }, body: "password=test" });
  assert.equal((await handleLogin(form, dependencies)).status, 400);
  assert.equal(attempts, 0);
});

test("rate limit denial, storage outage and missing config fail closed without leaking errors", async () => {
  const limited = await handleLogin(loginRequest(), { ...allowed, consume: async () => ({ allowed: false, retryAfter: 30 }) });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "30");
  for (const dependencies of [{ ...allowed, consume: async () => { throw new Error("sensitive storage details"); } }, { ...allowed, config: () => getAuthConfig({}) }]) {
    const response = await handleLogin(loginRequest(), dependencies);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Set-Cookie"), null);
    assert.ok(!(await response.text()).includes("sensitive"));
  }
});

test("only Vercel's trusted IP header is accepted in production; local spoofed headers do not change identity", () => {
  const request = loginRequest();
  request.headers.set("x-forwarded-for", "203.0.113.1");
  assert.throws(() => getClientIdentity(request, config, { NODE_ENV: "production", VERCEL: "1" }));
  request.headers.set("x-vercel-forwarded-for", "203.0.113.2");
  const identity = getClientIdentity(request, config, { NODE_ENV: "production", VERCEL: "1" });
  assert.notEqual(identity, "203.0.113.2");
  request.headers.set("x-forwarded-for", "203.0.113.9");
  assert.equal(getClientIdentity(request, config, { NODE_ENV: "production", VERCEL: "1" }), identity);
  assert.throws(() => getClientIdentity(request, config, { NODE_ENV: "production" }));
  const localConfig = getAuthConfig({ ...env, NODE_ENV: "development", FINANCE_APP_ORIGIN: "http://127.0.0.1:4200" });
  assert.equal(getClientIdentity(request, localConfig, { NODE_ENV: "development" }), "local-development");
  assert.throws(() => createRateLimitClient({ NODE_ENV: "production", AWS_REGION: "ap-northeast-2", FINANCE_DYNAMODB_ENDPOINT: "http://127.0.0.1:8000" }));
  assert.throws(() => createRateLimitClient({ NODE_ENV: "development", AWS_REGION: "ap-northeast-2", FINANCE_DYNAMODB_ENDPOINT: "http://remote.example" }));
});

test("route guard validates ownership and Origin independently of middleware; logout expires cookie", async () => withEnv(async () => {
  const token = await createSession(config);
  const request = new Request(config.origin, { method: "POST", headers: { Origin: config.origin, Cookie: sessionCookie(config, token).split(";")[0] } });
  assert.equal((await requireFinanceSession(request)).session?.ownerId, OWNER_ID);
  request.headers.delete("Origin");
  assert.equal((await requireFinanceSession(request)).response?.status, 403);
  request.headers.set("Origin", config.origin);
  const response = await logout(request);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("Set-Cookie")!.includes("Max-Age=0"));
  request.headers.set("Cookie", "__Host-finance-session=forged");
  assert.equal((await requireFinanceSession(request)).response?.status, 401);
  request.headers.set("Cookie", `__Host-finance-session=${token}; __Host-finance-session=${token}`);
  assert.equal((await requireFinanceSession(request)).response?.status, 401);
}));

test("middleware protects nested finance routes but exposes login; missing configuration closes APIs", async () => withEnv(async () => {
  assert.equal((await middleware(new NextRequest(`${config.origin}/finance/bots/example`))).status, 307);
  assert.equal((await middleware(new NextRequest(`${config.origin}/api/finance/bots`))).status, 401);
  assert.equal((await middleware(new NextRequest(`${config.origin}/finance/login`))).status, 200);
  const token = await createSession(config);
  const privateRequest = new NextRequest(`${config.origin}/api/finance/bots`, { headers: { Cookie: `__Host-finance-session=${token}` } });
  assert.equal((await middleware(privateRequest)).status, 200);
  const mutation = new NextRequest(`${config.origin}/api/finance/bots`, { method: "POST", headers: { Cookie: `__Host-finance-session=${token}` } });
  assert.equal((await middleware(mutation)).status, 403);
  delete process.env.FINANCE_SESSION_SECRET;
  assert.equal((await middleware(privateRequest)).status, 503);
}));
