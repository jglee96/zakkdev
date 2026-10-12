import assert from "node:assert/strict";
import { before, after, test, describe } from "node:test";
import { randomUUID } from "node:crypto";
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  type RunRepositoryConfig,
  createOrGetRun,
  getRun,
  acquireLease,
  renewLease,
  commitRunCompletion,
  requeueRun,
  cancelRun,
  LEASE_DURATION_MS,
} from "../../shared/finance/worker";

const isIntegration = process.env.TEST_TYPE === "integration";

const tableName = `WorkerTest-${randomUUID()}`;
let rawClient: DynamoDBClient;
let client: DynamoDBDocumentClient;
let config: RunRepositoryConfig;

before(async () => {
  if (!isIntegration) return;

  rawClient = new DynamoDBClient({
    region: "ap-northeast-2",
    endpoint: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });

  await rawClient.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
        { AttributeName: "ownerId", AttributeType: "S" },
        { AttributeName: "statusCreatedAt", AttributeType: "S" },
        { AttributeName: "routineId", AttributeType: "S" },
        { AttributeName: "scheduledAt", AttributeType: "S" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "ByOwnerStatus",
          KeySchema: [
            { AttributeName: "ownerId", KeyType: "HASH" },
            { AttributeName: "statusCreatedAt", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
        {
          IndexName: "ByRoutineScheduled",
          KeySchema: [
            { AttributeName: "routineId", KeyType: "HASH" },
            { AttributeName: "scheduledAt", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
      BillingMode: "PAY_PER_REQUEST",
    })
  );

  client = DynamoDBDocumentClient.from(rawClient, {
    marshallOptions: { removeUndefinedValues: true },
  });

  config = { tableName, client };
});

after(async () => {
  if (!isIntegration) return;
  await rawClient.send(new DeleteTableCommand({ TableName: tableName })).catch(() => undefined);
  rawClient.destroy();
});

describe("createOrGetRun", () => {
  test("creates new run with idempotency key", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const { run, created } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      routineId: "routine-1",
      routineVersion: 1,
      scheduledAt: "2026-10-12T16:00:00Z",
      instruction: "Test instruction",
    }, workerId);

    assert.ok(created);
    assert.equal(run.status, "queued");
    assert.equal(run.attempt, 0);
    assert.equal(run.fencingToken, 0);
  });

  test("returns existing run for same idempotency key", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;
    const scheduledAt = "2026-10-12T17:00:00Z";

    const { run: first, created: created1 } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      routineId: "routine-2",
      routineVersion: 1,
      scheduledAt,
      instruction: "Test instruction",
    }, workerId);

    const { run: second, created: created2 } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      routineId: "routine-2",
      routineVersion: 1,
      scheduledAt,
      instruction: "Different instruction",
    }, workerId);

    assert.ok(created1);
    assert.ok(!created2);
    assert.equal(first.id, second.id);
  });
});

describe("acquireLease", () => {
  test("acquires lease on queued run", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
    }, workerId);

    const result = await acquireLease(config, ownerId, run.id, workerId);

    assert.ok(result.acquired);
    assert.equal(result.run.status, "running");
    assert.equal(result.run.leaseOwner, workerId);
    assert.equal(result.fencingToken, 1);
  });

  test("fails to acquire lease when already held", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const worker1 = `worker-1-${randomUUID()}`;
    const worker2 = `worker-2-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
    }, worker1);

    const result1 = await acquireLease(config, ownerId, run.id, worker1);
    assert.ok(result1.acquired);

    const result2 = await acquireLease(config, ownerId, run.id, worker2);
    assert.ok(!result2.acquired);
    assert.equal(result2.reason, "already_running");
  });

  test("acquires lease after expiration", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const worker1 = `worker-1-${randomUUID()}`;
    const worker2 = `worker-2-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
    }, worker1);

    const result1 = await acquireLease(config, ownerId, run.id, worker1);
    assert.ok(result1.acquired);

    await client.send(
      new (await import("@aws-sdk/lib-dynamodb")).UpdateCommand({
        TableName: tableName,
        Key: { pk: `run#${ownerId}#${run.id}`, sk: "meta" },
        UpdateExpression: "SET leaseExpiresAt = :expired",
        ExpressionAttributeValues: { ":expired": Date.now() - 1000 },
      })
    );

    const result2 = await acquireLease(config, ownerId, run.id, worker2);
    assert.ok(result2.acquired);
    assert.equal(result2.run.leaseOwner, worker2);
    assert.equal(result2.fencingToken, 2);
  });

  test("returns stale_version when routine version differs", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      routineId: "routine-1",
      routineVersion: 1,
      scheduledAt: "2026-10-12T18:00:00Z",
      instruction: "Test",
    }, workerId);

    const result = await acquireLease(config, ownerId, run.id, workerId, 2);

    assert.ok(!result.acquired);
    assert.equal(result.reason, "stale_version");
  });
});

describe("renewLease", () => {
  test("renews lease successfully", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
    }, workerId);

    const acquired = await acquireLease(config, ownerId, run.id, workerId);
    assert.ok(acquired.acquired);

    const result = await renewLease(config, ownerId, run.id, workerId, acquired.fencingToken);

    assert.ok(result.renewed);
    assert.ok(result.newExpiresAt > Date.now());
  });

  test("fails to renew with wrong fencing token", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
    }, workerId);

    const acquired = await acquireLease(config, ownerId, run.id, workerId);
    assert.ok(acquired.acquired);

    const result = await renewLease(config, ownerId, run.id, workerId, acquired.fencingToken + 1);

    assert.ok(!result.renewed);
    assert.equal(result.reason, "fencing_violation");
  });

  test("fails to renew with wrong worker ID", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const worker1 = `worker-1-${randomUUID()}`;
    const worker2 = `worker-2-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
    }, worker1);

    const acquired = await acquireLease(config, ownerId, run.id, worker1);
    assert.ok(acquired.acquired);

    const result = await renewLease(config, ownerId, run.id, worker2, acquired.fencingToken);

    assert.ok(!result.renewed);
    assert.equal(result.reason, "lease_lost");
  });
});

describe("commitRunCompletion", () => {
  test("commits completed run", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
    }, workerId);

    const acquired = await acquireLease(config, ownerId, run.id, workerId);
    assert.ok(acquired.acquired);

    const usage = { steps: 2, calls: 3, inputTokens: 100, outputTokens: 50, costUsd: 0.001 };
    const result = await commitRunCompletion(
      config,
      ownerId,
      run.id,
      workerId,
      acquired.fencingToken,
      "completed",
      usage
    );

    assert.ok(result.committed);

    const finalRun = await getRun(config, ownerId, run.id);
    assert.equal(finalRun?.status, "completed");
    assert.deepEqual(finalRun?.usage, usage);
    assert.equal(finalRun?.leaseOwner, undefined);
  });

  test("fails to commit with wrong fencing token", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
    }, workerId);

    const acquired = await acquireLease(config, ownerId, run.id, workerId);
    assert.ok(acquired.acquired);

    const result = await commitRunCompletion(
      config,
      ownerId,
      run.id,
      workerId,
      acquired.fencingToken + 1,
      "completed"
    );

    assert.ok(!result.committed);
    assert.equal(result.reason, "fencing_violation");
  });

  test("late worker cannot overwrite completed run (fencing)", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const worker1 = `worker-1-${randomUUID()}`;
    const worker2 = `worker-2-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
    }, worker1);

    const acquired1 = await acquireLease(config, ownerId, run.id, worker1);
    assert.ok(acquired1.acquired);

    await client.send(
      new (await import("@aws-sdk/lib-dynamodb")).UpdateCommand({
        TableName: tableName,
        Key: { pk: `run#${ownerId}#${run.id}`, sk: "meta" },
        UpdateExpression: "SET leaseExpiresAt = :expired",
        ExpressionAttributeValues: { ":expired": Date.now() - 1000 },
      })
    );

    const acquired2 = await acquireLease(config, ownerId, run.id, worker2);
    assert.ok(acquired2.acquired);

    const commit2 = await commitRunCompletion(
      config,
      ownerId,
      run.id,
      worker2,
      acquired2.fencingToken,
      "completed",
      { steps: 1, calls: 1, inputTokens: 50, outputTokens: 25, costUsd: 0.0005 }
    );
    assert.ok(commit2.committed);

    const lateCommit = await commitRunCompletion(
      config,
      ownerId,
      run.id,
      worker1,
      acquired1.fencingToken,
      "completed",
      { steps: 2, calls: 2, inputTokens: 100, outputTokens: 50, costUsd: 0.001 }
    );
    assert.ok(!lateCommit.committed);
  });
});

describe("requeueRun", () => {
  test("requeues run for retry", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
      maxAttempts: 5,
    }, workerId);

    const acquired = await acquireLease(config, ownerId, run.id, workerId);
    assert.ok(acquired.acquired);

    const result = await requeueRun(
      config,
      ownerId,
      run.id,
      workerId,
      acquired.fencingToken,
      undefined,
      "Temporary error"
    );

    assert.ok(result.committed);

    const requeuedRun = await getRun(config, ownerId, run.id);
    assert.equal(requeuedRun?.status, "queued");
    assert.equal(requeuedRun?.error, "Temporary error");
  });

  test("fails run when max attempts reached", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
      maxAttempts: 1,
    }, workerId);

    const acquired = await acquireLease(config, ownerId, run.id, workerId);
    assert.ok(acquired.acquired);

    const result = await requeueRun(
      config,
      ownerId,
      run.id,
      workerId,
      acquired.fencingToken,
      undefined,
      "Final error"
    );

    assert.ok(result.committed);

    const failedRun = await getRun(config, ownerId, run.id);
    assert.equal(failedRun?.status, "failed");
    assert.equal(failedRun?.errorCode, "MAX_ATTEMPTS");
  });
});

describe("cancelRun", () => {
  test("cancels queued run", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
    }, workerId);

    const result = await cancelRun(config, ownerId, run.id, "Routine deleted");

    assert.ok(result);

    const canceledRun = await getRun(config, ownerId, run.id);
    assert.equal(canceledRun?.status, "canceled");
    assert.equal(canceledRun?.error, "Routine deleted");
  });

  test("cannot cancel completed run", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test",
    }, workerId);

    const acquired = await acquireLease(config, ownerId, run.id, workerId);
    assert.ok(acquired.acquired);
    await commitRunCompletion(config, ownerId, run.id, workerId, acquired.fencingToken, "completed");

    const result = await cancelRun(config, ownerId, run.id, "Too late");

    assert.ok(!result);
  });
});

describe("Duplicate event handling", () => {
  test("duplicate events produce no duplicate runs", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const routineId = `routine-${randomUUID()}`;
    const scheduledAt = "2026-10-12T19:00:00Z";

    const { run: run1, created: created1 } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      routineId,
      routineVersion: 1,
      scheduledAt,
      instruction: "Test",
    }, "worker-1");

    const { run: run2, created: created2 } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      routineId,
      routineVersion: 1,
      scheduledAt,
      instruction: "Test",
    }, "worker-2");

    const { run: run3, created: created3 } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      routineId,
      routineVersion: 1,
      scheduledAt,
      instruction: "Test",
    }, "worker-3");

    assert.ok(created1);
    assert.ok(!created2);
    assert.ok(!created3);
    assert.equal(run1.id, run2.id);
    assert.equal(run2.id, run3.id);
  });
});
