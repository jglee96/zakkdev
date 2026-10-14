import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("finance-worker CDK synthesizes single FinanceData table and Nodejs worker", () => {
  const output = mkdtempSync(join(tmpdir(), "finance-worker-cdk-"));
  try {
    const command = spawnSync(
      "node_modules/.bin/tsx",
      ["infra/finance-worker.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          CDK_OUTDIR: output,
          AWS_REGION: "ap-northeast-2",
          CDK_CONTEXT_JSON: JSON.stringify({ vercelRuntimeRoleName: "test-vercel-role" }),
        },
      },
    );
    assert.equal(command.status, 0, command.stderr || command.stdout);

    const template = JSON.parse(
      readFileSync(join(output, "FinanceWorker.template.json"), "utf8"),
    );
    const resources = Object.values(template.Resources) as {
      Type: string;
      Properties: Record<string, unknown>;
    }[];

    const tables = resources.filter((r) => r.Type === "AWS::DynamoDB::Table");
    assert.equal(tables.length, 1, "expected single FINANCE_DATA_TABLE");
    assert.ok(
      (tables[0].Properties.GlobalSecondaryIndexes as unknown[])?.length === 2,
      "expected ByOwnerStatus and ByRoutineScheduled GSIs",
    );

    const lambdas = resources.filter((r) => r.Type === "AWS::Lambda::Function");
    assert.ok(lambdas.some((fn) => fn.Properties.FunctionName === "finance-agent-worker"));

    const outputs = template.Outputs as Record<string, { Value: unknown }>;
    assert.ok(outputs.FinanceDataTableName);
    assert.ok(outputs.SchedulerRoleArn);
    assert.ok(outputs.VercelSchedulerTargetQueueArn);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
