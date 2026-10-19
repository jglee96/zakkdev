import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  assertFinanceSchedulerProductionConfig,
  createFakeSchedulerClient,
  resetFakeSchedulerForTests,
  resolveFinanceSchedulerMode,
  SchedulerConfigurationError,
  shouldUseRoutineOrchestrator,
} from "../../shared/finance/schedule";
describe("scheduler runtime mode", () => {
  test("auto resolves to fake when DynamoDB local endpoint is set", () => {
    assert.equal(
      resolveFinanceSchedulerMode({
        FINANCE_SCHEDULER_MODE: "auto",
        FINANCE_DYNAMODB_ENDPOINT: "http://127.0.0.1:8000",
      }),
      "fake",
    );
  });

  test("auto resolves to aws when scheduler target ARNs are set", () => {
    assert.equal(
      resolveFinanceSchedulerMode({
        FINANCE_SCHEDULER_MODE: "auto",
        FINANCE_SCHEDULER_TARGET_QUEUE_ARN: "arn:aws:sqs:ap-northeast-2:1:q",
        FINANCE_SCHEDULER_TARGET_DLQ_ARN: "arn:aws:sqs:ap-northeast-2:1:dlq",
        FINANCE_SCHEDULER_ROLE_ARN: "arn:aws:iam::1:role/s",
      }),
      "aws",
    );
  });

  test("auto stays off when queue and role set but DLQ missing", () => {
    assert.equal(
      resolveFinanceSchedulerMode({
        FINANCE_SCHEDULER_MODE: "auto",
        FINANCE_SCHEDULER_TARGET_QUEUE_ARN: "arn:aws:sqs:ap-northeast-2:1:q",
        FINANCE_SCHEDULER_ROLE_ARN: "arn:aws:iam::1:role/s",
      }),
      "off",
    );
  });

  test("production rejects auto resolving to off", () => {
    assert.throws(
      () =>
        assertFinanceSchedulerProductionConfig({
          VERCEL_ENV: "production",
          FINANCE_SCHEDULER_MODE: "auto",
        }),
      SchedulerConfigurationError,
    );
  });

  test("production rejects explicit fake scheduler", () => {
    assert.throws(
      () =>
        assertFinanceSchedulerProductionConfig({
          VERCEL_ENV: "production",
          FINANCE_SCHEDULER_MODE: "fake",
          FINANCE_SCHEDULER_TARGET_QUEUE_ARN: "arn:aws:sqs:ap-northeast-2:1:q",
          FINANCE_SCHEDULER_TARGET_DLQ_ARN: "arn:aws:sqs:ap-northeast-2:1:dlq",
          FINANCE_SCHEDULER_ROLE_ARN: "arn:aws:iam::1:role/s",
        }),
      SchedulerConfigurationError,
    );
  });

  test("off disables orchestrator usage", () => {
    assert.equal(shouldUseRoutineOrchestrator("off"), false);
    assert.equal(shouldUseRoutineOrchestrator("fake"), true);
  });
});

test("fake scheduler client resets between tests", () => {
  resetFakeSchedulerForTests();
  const client = createFakeSchedulerClient();
  assert.equal(client.getSchedules().size, 0);
});
