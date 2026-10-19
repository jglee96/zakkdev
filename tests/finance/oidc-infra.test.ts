import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("finance-vercel-oidc synthesizes OIDC provider and runtime role", () => {
  const output = mkdtempSync(join(tmpdir(), "finance-vercel-oidc-"));
  try {
    const command = spawnSync("node_modules/.bin/tsx", ["infra/finance-vercel-oidc.ts"], {
      encoding: "utf8",
      env: {
        ...process.env,
        CDK_OUTDIR: output,
        CDK_CONTEXT_JSON: JSON.stringify({
          vercelTeamSlug: "acme-team",
          vercelProjectName: "zakkdev",
          vercelRuntimeRoleName: "finance-vercel-runtime",
        }),
      },
    });
    assert.equal(command.status, 0, command.stderr || command.stdout);
    const template = JSON.parse(
      readFileSync(join(output, "FinanceVercelOidc.template.json"), "utf8"),
    );
    const resources = Object.values(template.Resources) as { Type: string }[];
    assert.ok(
      resources.some(
        (r) =>
          r.Type === "AWS::IAM::OIDCProvider" ||
          r.Type === "Custom::AWSCDKOpenIdConnectProvider",
      ),
    );
    assert.ok(resources.some((r) => r.Type === "AWS::IAM::Role"));
    assert.ok(template.Outputs.VercelRuntimeRoleArn);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("finance-github-oidc synthesizes deploy and diff roles", () => {
  const output = mkdtempSync(join(tmpdir(), "finance-github-oidc-"));
  try {
    const command = spawnSync("node_modules/.bin/tsx", ["infra/finance-github-oidc.ts"], {
      encoding: "utf8",
      env: {
        ...process.env,
        CDK_OUTDIR: output,
        CDK_CONTEXT_JSON: JSON.stringify({ githubRepository: "jglee96/zakkdev" }),
      },
    });
    assert.equal(command.status, 0, command.stderr || command.stdout);
    const template = JSON.parse(
      readFileSync(join(output, "FinanceGithubOidc.template.json"), "utf8"),
    );
    const resources = Object.values(template.Resources) as { Type: string }[];
    assert.ok(
      resources.some(
        (r) =>
          r.Type === "AWS::IAM::OIDCProvider" ||
          r.Type === "Custom::AWSCDKOpenIdConnectProvider",
      ),
    );
    const roles = resources.filter((r) => r.Type === "AWS::IAM::Role");
    assert.ok(roles.length >= 2, "expected deploy and diff roles");
    assert.ok(template.Outputs.GithubDeployRoleArn);
    assert.ok(template.Outputs.GithubDiffRoleArn);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
