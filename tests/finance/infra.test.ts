import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("CDK synthesizes retained on-demand TTL storage and table-scoped runtime permissions", () => {
  const output = mkdtempSync(join(tmpdir(), "finance-cdk-"));
  try {
    const command = spawnSync("node_modules/.bin/tsx", ["infra/finance-auth.ts"], { encoding: "utf8", env: { ...process.env, CDK_OUTDIR: output, CDK_CONTEXT_JSON: JSON.stringify({ runtimeRoleName: "test-vercel-role" }) } });
    assert.equal(command.status, 0, command.stderr);
    const template = JSON.parse(readFileSync(join(output, "FinanceAuth.template.json"), "utf8"));
    const resources = Object.values(template.Resources) as { Type: string; Properties: Record<string, unknown>; DeletionPolicy?: string }[];
    const table = resources.find((r) => r.Type === "AWS::DynamoDB::Table")!;
    assert.equal(table.DeletionPolicy, "Retain");
    assert.equal(table.Properties.BillingMode, "PAY_PER_REQUEST");
    assert.deepEqual(table.Properties.TimeToLiveSpecification, { AttributeName: "expiresAt", Enabled: true });
    const policy = resources.find((r) => r.Type === "AWS::IAM::Policy")!;
    assert.deepEqual(policy.Properties.Roles, ["test-vercel-role"]);
    const document = policy.Properties.PolicyDocument as { Statement: { Action: string; Resource: unknown }[] };
    assert.equal(document.Statement[0].Action, "dynamodb:UpdateItem");
    assert.notEqual(document.Statement[0].Resource, "*");
  } finally { rmSync(output, { recursive: true, force: true }); }
});
