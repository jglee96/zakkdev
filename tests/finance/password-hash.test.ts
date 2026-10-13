import assert from "node:assert/strict";
import { test } from "node:test";
import { hash, verify } from "@node-rs/argon2";
import { getAuthConfig } from "../../shared/finance/auth/config";
import { randomBytes } from "node:crypto";

const PASSWORD = "synthetic-password-for-hash-test";

test("argon2 hashes from default and explicit credential params both verify", async () => {
  const defaultHash = await hash(PASSWORD);
  const explicitHash = await hash(PASSWORD, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

  assert.ok(await verify(defaultHash, PASSWORD), "default hash should verify");
  assert.ok(await verify(explicitHash, PASSWORD), "explicit credential hash should verify");
  assert.notEqual(defaultHash, explicitHash, "distinct salts should produce distinct hashes");
});

test("getAuthConfig accepts hashes produced with default and credential generator params", async () => {
  const secret = randomBytes(32).toString("base64url");
  const base = {
    NODE_ENV: "development",
    FINANCE_APP_ORIGIN: "http://127.0.0.1:4203",
    FINANCE_SESSION_SECRET: secret,
    FINANCE_DYNAMODB_ENDPOINT: "http://127.0.0.1:8000",
  };

  for (const passwordHash of [
    await hash(PASSWORD),
    await hash(PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 }),
  ]) {
    const config = getAuthConfig({ ...base, FINANCE_PASSWORD_HASH: passwordHash });
    assert.ok(await verify(config.passwordHash, PASSWORD));
  }
});
