import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  isVercelRuntime,
  resolveFinanceAwsCredentialMode,
  resolveFinanceLocalDynamoEndpoint,
} from "../../shared/finance/aws/credentials";

describe("finance AWS credential mode", () => {
  test("local DynamoDB endpoint uses static local credentials", () => {
    assert.equal(
      resolveFinanceAwsCredentialMode({
        NODE_ENV: "development",
        FINANCE_DYNAMODB_ENDPOINT: "http://127.0.0.1:8000",
        AWS_ROLE_ARN: "arn:aws:iam::1:role/x",
        VERCEL: "1",
      }),
      "local-static",
    );
  });

  test("Vercel with AWS_ROLE_ARN uses vercel-oidc when not on local endpoint", () => {
    assert.equal(
      resolveFinanceAwsCredentialMode({
        VERCEL: "1",
        VERCEL_ENV: "production",
        AWS_ROLE_ARN: "arn:aws:iam::123456789012:role/finance-vercel-runtime",
      }),
      "vercel-oidc",
    );
  });

  test("AWS_ROLE_ARN without Vercel uses default provider chain", () => {
    assert.equal(
      resolveFinanceAwsCredentialMode({
        AWS_ROLE_ARN: "arn:aws:iam::123456789012:role/some-role",
        NODE_ENV: "production",
      }),
      "default-chain",
    );
  });

  test("no role and no local endpoint uses default chain", () => {
    assert.equal(resolveFinanceAwsCredentialMode({ AWS_REGION: "ap-northeast-2" }), "default-chain");
  });

  test("isVercelRuntime detects VERCEL env", () => {
    assert.equal(isVercelRuntime({ VERCEL: "1" }), true);
    assert.equal(isVercelRuntime({ VERCEL_ENV: "preview" }), true);
    assert.equal(isVercelRuntime({ NODE_ENV: "production" }), false);
  });
});

describe("resolveFinanceLocalDynamoEndpoint", () => {
  test("allows localhost http endpoint in development", () => {
    assert.equal(
      resolveFinanceLocalDynamoEndpoint({
        NODE_ENV: "development",
        FINANCE_DYNAMODB_ENDPOINT: "http://127.0.0.1:8000",
      }),
      "http://127.0.0.1:8000",
    );
  });

  test("rejects local endpoint in production", () => {
    assert.throws(
      () =>
        resolveFinanceLocalDynamoEndpoint({
          NODE_ENV: "production",
          FINANCE_DYNAMODB_ENDPOINT: "http://127.0.0.1:8000",
        }),
      /not allowed/,
    );
  });
});
