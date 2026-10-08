import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("credential helper writes private files without overwrite or stdout disclosure and Next loads the escaped Argon2 hash", () => {
  const directory = mkdtempSync(join(tmpdir(), "finance-credentials-"));
  const output = join(directory, ".env.local");
  try {
    const generate = () => spawnSync("node_modules/.bin/tsx", ["scripts/finance-credentials.ts", output], { encoding: "utf8", input: "synthetic-password-for-test" });
    const first = generate();
    assert.equal(first.status, 0, first.stderr);
    const contents = readFileSync(output, "utf8");
    assert.ok(!contents.includes("synthetic-password-for-test"));
    assert.ok(!first.stdout.includes("argon2id") && !first.stdout.includes("FINANCE_SESSION_SECRET="));
    assert.equal(statSync(output).mode & 0o777, 0o600);
    assert.notEqual(generate().status, 0);
    assert.equal(readFileSync(output, "utf8"), contents);
    const loaded = spawnSync(process.execPath, ["-e", `
      const requireNext = require('node:module').createRequire(require.resolve('next/package.json'));
      const { loadEnvConfig } = requireNext('@next/env');
      const { verify } = require('@node-rs/argon2');
      const { combinedEnv } = loadEnvConfig(process.argv[1], true, { info() {}, error() {} }, true);
      verify(combinedEnv.FINANCE_PASSWORD_HASH, 'synthetic-password-for-test').then(valid => {
        if (!valid || Buffer.from(combinedEnv.FINANCE_SESSION_SECRET, 'base64url').length !== 32) process.exitCode = 1;
      }).catch(() => { process.exitCode = 1; });
    `, directory], { encoding: "utf8", env: { ...process.env, FINANCE_PASSWORD_HASH: undefined, FINANCE_SESSION_SECRET: undefined } });
    assert.equal(loaded.status, 0, loaded.stderr);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
