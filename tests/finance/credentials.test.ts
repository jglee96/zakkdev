import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
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

test("source code never exposes sensitive credentials via NEXT_PUBLIC_ prefix", () => {
  const sensitivePatterns = [
    /NEXT_PUBLIC_.*(?:PASSWORD|SECRET|KEY|CREDENTIAL|TOKEN|HASH|AWS_|OPENROUTER)/i,
    /NEXT_PUBLIC_FINANCE_/i,
  ];
  const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs"];
  const ignoreDirs = ["node_modules", ".next", ".git", "dist", "coverage", "tests"];

  function scanDirectory(dir: string, files: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (ignoreDirs.includes(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirectory(fullPath, files);
      } else if (sourceExtensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const projectRoot = join(__dirname, "../..");
  const sourceFiles = scanDirectory(projectRoot);
  const violations: string[] = [];

  for (const file of sourceFiles) {
    const content = readFileSync(file, "utf8");
    for (const pattern of sensitivePatterns) {
      if (pattern.test(content)) {
        violations.push(`${file}: matches ${pattern}`);
      }
    }
  }

  assert.deepEqual(violations, [], `Found NEXT_PUBLIC_ sensitive credential references:\n${violations.join("\n")}`);
});

test("finance auth modules use server-only directive", () => {
  const authModules = [
    "shared/finance/auth/config.ts",
    "shared/finance/auth/guard.ts",
    "shared/finance/auth/http.ts",
    "shared/finance/auth/login.ts",
    "shared/finance/auth/rate-limit.ts",
    "shared/finance/auth/session.ts",
    "shared/finance/cost/config.ts",
    "shared/finance/cost/budget.ts",
    "shared/finance/cost/run-tracker.ts",
  ];
  const projectRoot = join(__dirname, "../..");

  for (const modulePath of authModules) {
    const fullPath = join(projectRoot, modulePath);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, "utf8");
    assert.ok(
      content.includes('import "server-only"') || content.includes("import 'server-only'"),
      `${modulePath} must import server-only to prevent client bundling`
    );
  }
});

test("environment variable names follow isolation pattern", () => {
  const serverOnlyEnvVars = [
    "FINANCE_PASSWORD_HASH",
    "FINANCE_SESSION_SECRET",
    "FINANCE_APP_ORIGIN",
    "FINANCE_AUTH_TABLE",
    "FINANCE_BUDGET_TABLE",
    "OPENROUTER_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
  ];
  const projectRoot = join(__dirname, "../..");
  const sourceFiles = [
    "shared/finance/auth/config.ts",
    "shared/finance/auth/login.ts",
    "shared/finance/auth/rate-limit.ts",
    "shared/finance/cost/config.ts",
    "shared/finance/cost/budget.ts",
  ];

  for (const file of sourceFiles) {
    const fullPath = join(projectRoot, file);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, "utf8");
    for (const envVar of serverOnlyEnvVars) {
      if (content.includes(envVar)) {
        assert.ok(
          !content.includes(`NEXT_PUBLIC_${envVar}`),
          `${file} must not use NEXT_PUBLIC_ prefix for ${envVar}`
        );
      }
    }
  }
});
