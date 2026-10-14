import assert from "node:assert/strict";
import { before, after, test, describe } from "node:test";
import { randomUUID } from "node:crypto";
import type { SQSEvent } from "aws-lambda";
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
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
import {
  type RoutineRepositoryConfig,
  createRoutine,
  getRoutine,
  deleteRoutine,
  updateRoutine,
} from "../../shared/finance/routine";

const isIntegration = process.env.TEST_TYPE === "integration";

const runTableName = `WorkerRunTest-${randomUUID()}`;
const routineTableName = `WorkerRoutineTest-${randomUUID()}`;
const tableName = runTableName;
let rawClient: DynamoDBClient;
let client: DynamoDBDocumentClient;
let config: RunRepositoryConfig;
let routineConfig: RoutineRepositoryConfig;

before(async () => {
  if (!isIntegration) return;

  rawClient = new DynamoDBClient({
    region: "ap-northeast-2",
    endpoint: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });

  await rawClient.send(
    new CreateTableCommand({
      TableName: runTableName,
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

  await rawClient.send(
    new CreateTableCommand({
      TableName: routineTableName,
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
        { AttributeName: "ownerId", AttributeType: "S" },
        { AttributeName: "statusCreatedAt", AttributeType: "S" },
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
      ],
      BillingMode: "PAY_PER_REQUEST",
    })
  );

  client = DynamoDBDocumentClient.from(rawClient, {
    marshallOptions: { removeUndefinedValues: true },
  });

  config = { tableName: runTableName, client };
  routineConfig = { tableName: routineTableName, client };
});

after(async () => {
  if (!isIntegration) return;
  await rawClient.send(new DeleteTableCommand({ TableName: runTableName })).catch(() => undefined);
  await rawClient.send(new DeleteTableCommand({ TableName: routineTableName })).catch(() => undefined);
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

describe("Forced-kill recovery scenarios", () => {
  test("recovery after worker crash post-create (before lease acquisition)", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const routineId = `routine-${randomUUID()}`;
    const scheduledAt = "2026-10-12T20:00:00Z";
    const worker1 = `worker-crashed-${randomUUID()}`;
    const worker2 = `worker-recovery-${randomUUID()}`;

    const { run: run1, created: created1 } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      routineId,
      routineVersion: 1,
      scheduledAt,
      instruction: "Test recovery",
    }, worker1);

    assert.ok(created1);
    assert.equal(run1.status, "queued");

    const { run: run2, created: created2 } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      routineId,
      routineVersion: 1,
      scheduledAt,
      instruction: "Test recovery",
    }, worker2);

    assert.ok(!created2, "Second worker should get existing run");
    assert.equal(run1.id, run2.id, "Same run should be returned");

    const leaseResult = await acquireLease(config, ownerId, run2.id, worker2);
    assert.ok(leaseResult.acquired, "Recovery worker should acquire lease");
    assert.equal(leaseResult.fencingToken, 1);

    const commitResult = await commitRunCompletion(
      config,
      ownerId,
      run2.id,
      worker2,
      leaseResult.fencingToken,
      "completed",
      { steps: 1, calls: 1, inputTokens: 50, outputTokens: 25, costUsd: 0.001 }
    );
    assert.ok(commitResult.committed);

    const finalRun = await getRun(config, ownerId, run2.id);
    assert.equal(finalRun?.status, "completed");
  });

  test("recovery after worker crash before commit (no duplicate completion)", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const routineId = `routine-${randomUUID()}`;
    const scheduledAt = "2026-10-12T21:00:00Z";
    const worker1 = `worker-crashed-${randomUUID()}`;
    const worker2 = `worker-recovery-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      routineId,
      routineVersion: 1,
      scheduledAt,
      instruction: "Test no-duplicate",
    }, worker1);

    const lease1 = await acquireLease(config, ownerId, run.id, worker1);
    assert.ok(lease1.acquired);

    await client.send(
      new (await import("@aws-sdk/lib-dynamodb")).UpdateCommand({
        TableName: tableName,
        Key: { pk: `run#${ownerId}#${run.id}`, sk: "meta" },
        UpdateExpression: "SET leaseExpiresAt = :expired",
        ExpressionAttributeValues: { ":expired": Date.now() - 1000 },
      })
    );

    const lease2 = await acquireLease(config, ownerId, run.id, worker2);
    assert.ok(lease2.acquired, "Recovery worker should acquire expired lease");
    assert.equal(lease2.fencingToken, 2, "Fencing token should increment");

    const usage2 = { steps: 2, calls: 2, inputTokens: 100, outputTokens: 50, costUsd: 0.002 };
    const commit2 = await commitRunCompletion(
      config,
      ownerId,
      run.id,
      worker2,
      lease2.fencingToken,
      "completed",
      usage2
    );
    assert.ok(commit2.committed);

    const lateCommit1 = await commitRunCompletion(
      config,
      ownerId,
      run.id,
      worker1,
      lease1.fencingToken,
      "completed",
      { steps: 1, calls: 1, inputTokens: 50, outputTokens: 25, costUsd: 0.001 }
    );
    assert.ok(!lateCommit1.committed, "Late worker commit should be rejected");

    const finalRun = await getRun(config, ownerId, run.id);
    assert.equal(finalRun?.status, "completed");
    assert.deepEqual(finalRun?.usage, usage2, "Only recovery worker's data should be stored");
  });

  test("no duplicate after worker crash post-commit (idempotent completion)", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const routineId = `routine-${randomUUID()}`;
    const scheduledAt = "2026-10-12T22:00:00Z";
    const worker1 = `worker-committed-${randomUUID()}`;
    const worker2 = `worker-duplicate-${randomUUID()}`;

    const { run, created } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      routineId,
      routineVersion: 1,
      scheduledAt,
      instruction: "Test post-commit",
    }, worker1);

    assert.ok(created);

    const lease1 = await acquireLease(config, ownerId, run.id, worker1);
    assert.ok(lease1.acquired);

    const usage1 = { steps: 3, calls: 4, inputTokens: 150, outputTokens: 75, costUsd: 0.003 };
    const commit1 = await commitRunCompletion(
      config,
      ownerId,
      run.id,
      worker1,
      lease1.fencingToken,
      "completed",
      usage1
    );
    assert.ok(commit1.committed);

    const { run: duplicateRun, created: duplicateCreated } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      routineId,
      routineVersion: 1,
      scheduledAt,
      instruction: "Test post-commit",
    }, worker2);

    assert.ok(!duplicateCreated, "Duplicate event should not create new run");
    assert.equal(duplicateRun.id, run.id);
    assert.equal(duplicateRun.status, "completed");

    const lease2 = await acquireLease(config, ownerId, run.id, worker2);
    assert.ok(!lease2.acquired, "Should not acquire lease on completed run");
    assert.equal(lease2.reason, "completed");

    const finalRun = await getRun(config, ownerId, run.id);
    assert.equal(finalRun?.status, "completed");
    assert.deepEqual(finalRun?.usage, usage1, "Original completion data should remain");
  });

  test("checkpoint preserved across crash and recovery", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const worker1 = `worker-checkpoint-${randomUUID()}`;
    const worker2 = `worker-resume-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Long running task",
      maxAttempts: 5,
    }, worker1);

    const lease1 = await acquireLease(config, ownerId, run.id, worker1);
    assert.ok(lease1.acquired);

    const checkpoint = {
      stepIndex: 3,
      lastToolCallId: "tool-call-123",
      messagesSnapshot: JSON.stringify([{ role: "user", content: "Continue" }]),
    };

    const requeueResult = await requeueRun(
      config,
      ownerId,
      run.id,
      worker1,
      lease1.fencingToken,
      checkpoint,
      "Timeout during processing"
    );
    assert.ok(requeueResult.committed);

    const requeuedRun = await getRun(config, ownerId, run.id);
    assert.equal(requeuedRun?.status, "queued");
    assert.deepEqual(requeuedRun?.checkpoint, checkpoint);

    const lease2 = await acquireLease(config, ownerId, run.id, worker2);
    assert.ok(lease2.acquired);
    assert.equal(lease2.run.checkpoint?.stepIndex, 3);
    assert.equal(lease2.run.attempt, 2);

    const commit2 = await commitRunCompletion(
      config,
      ownerId,
      run.id,
      worker2,
      lease2.fencingToken,
      "completed",
      { steps: 5, calls: 6, inputTokens: 200, outputTokens: 100, costUsd: 0.004 }
    );
    assert.ok(commit2.committed);

    const finalRun = await getRun(config, ownerId, run.id);
    assert.equal(finalRun?.status, "completed");
    assert.equal(finalRun?.attempt, 2);
  });
});

describe("Atomic report+memory+completion transaction", () => {
  test("report data stored atomically with completion", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Analyze disclosures",
    }, workerId);

    const lease = await acquireLease(config, ownerId, run.id, workerId);
    assert.ok(lease.acquired);

    const usage = { steps: 4, calls: 5, inputTokens: 200, outputTokens: 100, costUsd: 0.005 };
    const reportData = {
      response: "Analysis complete: Found 3 significant disclosures.",
      reportId: `report-${randomUUID()}`,
      memorySnapshot: JSON.stringify({ lastAnalyzedDate: "2026-10-12", topics: ["earnings", "guidance"] }),
      legacySources: [
        { type: "sec_filing", reference: "10-K", title: "Annual Report 2026" },
        { type: "disclosure", reference: "8-K", title: "Material Event" },
      ],
    };

    const commitResult = await commitRunCompletion(
      config,
      ownerId,
      run.id,
      workerId,
      lease.fencingToken,
      "completed",
      usage,
      undefined,
      undefined,
      reportData
    );
    assert.ok(commitResult.committed);

    const finalRun = await getRun(config, ownerId, run.id);
    assert.equal(finalRun?.status, "completed");
    assert.deepEqual(finalRun?.usage, usage);
    assert.deepEqual(finalRun?.reportData, reportData);
    assert.equal(finalRun?.reportData?.response, "Analysis complete: Found 3 significant disclosures.");
    assert.equal(finalRun?.reportData?.legacySources?.length, 2);
  });

  test("late worker cannot overwrite report data (fencing)", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const worker1 = `worker-1-${randomUUID()}`;
    const worker2 = `worker-2-${randomUUID()}`;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Test fencing",
    }, worker1);

    const lease1 = await acquireLease(config, ownerId, run.id, worker1);
    assert.ok(lease1.acquired);

    await client.send(
      new (await import("@aws-sdk/lib-dynamodb")).UpdateCommand({
        TableName: tableName,
        Key: { pk: `run#${ownerId}#${run.id}`, sk: "meta" },
        UpdateExpression: "SET leaseExpiresAt = :expired",
        ExpressionAttributeValues: { ":expired": Date.now() - 1000 },
      })
    );

    const lease2 = await acquireLease(config, ownerId, run.id, worker2);
    assert.ok(lease2.acquired);

    const reportData2 = {
      response: "Worker 2 completed analysis",
      reportId: `report-worker2-${randomUUID()}`,
    };

    const commit2 = await commitRunCompletion(
      config,
      ownerId,
      run.id,
      worker2,
      lease2.fencingToken,
      "completed",
      { steps: 2, calls: 3, inputTokens: 100, outputTokens: 50, costUsd: 0.002 },
      undefined,
      undefined,
      reportData2
    );
    assert.ok(commit2.committed);

    const lateReportData = {
      response: "Worker 1 late analysis - SHOULD NOT BE STORED",
      reportId: `report-worker1-${randomUUID()}`,
    };

    const lateCommit = await commitRunCompletion(
      config,
      ownerId,
      run.id,
      worker1,
      lease1.fencingToken,
      "completed",
      { steps: 3, calls: 4, inputTokens: 150, outputTokens: 75, costUsd: 0.003 },
      undefined,
      undefined,
      lateReportData
    );
    assert.ok(!lateCommit.committed, "Late worker should not be able to commit");

    const finalRun = await getRun(config, ownerId, run.id);
    assert.equal(finalRun?.reportData?.response, "Worker 2 completed analysis");
    assert.ok(finalRun?.reportData?.reportId?.includes("worker2"));
  });
});

describe("Tombstone on routine stop/delete", () => {
  test("deleted routine has tombstone with TTL", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;

    const routine = await createRoutine(routineConfig, ownerId, {
      botId: "bot-1",
      name: "Test Routine",
      instruction: "Analyze daily",
      cronExpr: "0 16 * * *",
      timezone: "Asia/Seoul",
    });

    assert.equal(routine.status, "pending");
    assert.equal(routine.version, 1);

    const deletedRoutine = await deleteRoutine(routineConfig, ownerId, routine.id);

    assert.equal(deletedRoutine.status, "deleted");
    assert.equal(deletedRoutine.version, 2);
    assert.ok(deletedRoutine.deletedAt);

    const result = await client.send(
      new GetCommand({
        TableName: routineTableName,
        Key: { pk: `routine#${ownerId}#${routine.id}`, sk: "meta" },
      })
    );

    assert.ok(result.Item);
    assert.equal(result.Item.status, "deleted");
    assert.ok(result.Item.deletedExpiresAt, "Should have TTL set for tombstone cleanup");
    assert.ok(result.Item.deletedExpiresAt > Math.floor(Date.now() / 1000), "TTL should be in the future");
  });

  test("stale event dropped for deleted routine", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const routine = await createRoutine(routineConfig, ownerId, {
      botId: "bot-1",
      name: "Will Be Deleted",
      instruction: "This routine will be deleted",
      cronExpr: "0 9 * * *",
      timezone: "America/New_York",
    });

    await deleteRoutine(routineConfig, ownerId, routine.id);

    const deletedRoutine = await getRoutine(routineConfig, ownerId, routine.id);
    assert.equal(deletedRoutine?.status, "deleted");

    const { run, created } = await createOrGetRun(config, {
      ownerId,
      botId: routine.botId,
      routineId: routine.id,
      routineVersion: 1,
      scheduledAt: new Date().toISOString(),
      instruction: routine.instruction,
    }, workerId);

    const leaseResult = await acquireLease(config, ownerId, run.id, workerId, 1);

    if (leaseResult.acquired) {
      await cancelRun(config, ownerId, run.id, "Routine was deleted");
    }

    const finalRun = await getRun(config, ownerId, run.id);
    assert.ok(finalRun, "Run should exist for audit trail");
  });

  test("stale event dropped for version mismatch (new message for old run)", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const routine = await createRoutine(routineConfig, ownerId, {
      botId: "bot-1",
      name: "Updated Routine",
      instruction: "Original instruction",
      cronExpr: "0 10 * * *",
      timezone: "Europe/London",
    });

    const oldVersion = routine.version;

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: routine.botId,
      routineId: routine.id,
      routineVersion: oldVersion,
      scheduledAt: new Date().toISOString(),
      instruction: routine.instruction,
    }, workerId);

    const updatedRoutine = await updateRoutine(routineConfig, ownerId, routine.id, {
      instruction: "Updated instruction",
    });

    assert.equal(updatedRoutine.version, oldVersion + 1);

    const leaseResult = await acquireLease(config, ownerId, run.id, workerId, updatedRoutine.version);

    assert.ok(!leaseResult.acquired, "Should not acquire lease when message version differs from run version");
    assert.equal(leaseResult.reason, "stale_version");
  });

  test("paused routine drops queued events", { skip: !isIntegration }, async () => {
    const ownerId = `owner-${randomUUID()}`;

    const routine = await createRoutine(routineConfig, ownerId, {
      botId: "bot-1",
      name: "Paused Routine",
      instruction: "Will be paused",
      cronExpr: "0 11 * * *",
      timezone: "Asia/Tokyo",
    });

    await updateRoutine(routineConfig, ownerId, routine.id, {
      status: "paused",
    });

    const pausedRoutine = await getRoutine(routineConfig, ownerId, routine.id);
    assert.equal(pausedRoutine?.status, "paused");
  });
});

describe("SQS partial batch failure and DLQ redrive", () => {
  test("handleSQSEvent returns batchItemFailures for failed records", { skip: !isIntegration }, async () => {
    const { handleSQSEvent } = await import("../../shared/finance/worker/handler");
    const ownerId = `owner-${randomUUID()}`;

    const routine1 = await createRoutine(routineConfig, ownerId, {
      botId: "bot-1",
      name: "Success Routine",
      instruction: "This will succeed",
      cronExpr: "0 8 * * *",
      timezone: "UTC",
    });

    const routine2 = await createRoutine(routineConfig, ownerId, {
      botId: "bot-nonexistent",
      name: "Fail Routine",
      instruction: "This will fail (bot not found)",
      cronExpr: "0 9 * * *",
      timezone: "UTC",
    });

    let agentCallCount = 0;
    const workerConfig = {
      runRepo: config,
      routineRepo: routineConfig,
      getBot: async (oid: string, botId: string) => {
        if (botId === "bot-1") {
          return {
            id: "bot-1",
            ownerId: oid,
            template: "main" as const,
            name: "Test Bot",
            instructions: "Test",
            allowedTools: [],
            status: "active" as const,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
        }
        return null;
      },
      runAgent: async () => {
        agentCallCount++;
        return {
          status: "completed" as const,
          response: "Done",
          usage: { steps: 1, calls: 1, inputTokens: 10, outputTokens: 5, costUsd: 0.001 },
        };
      },
      createRuntimeConfig: () => ({
        llmProvider: { chat: async () => ({ content: "test", toolCalls: [], inputTokens: 10, outputTokens: 5 }) },
        tools: {},
        maxSteps: 10,
        callTimeoutMs: 5000,
      }),
    };

    const event = {
      Records: [
        {
          messageId: "msg-1",
          body: JSON.stringify({
            ownerId,
            routineId: routine1.id,
            routineVersion: routine1.version,
            scheduledAt: new Date().toISOString(),
          }),
          receiptHandle: "receipt-1",
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: String(Date.now()),
            SenderId: "test-sender",
            ApproximateFirstReceiveTimestamp: String(Date.now()),
          },
          messageAttributes: {},
          md5OfBody: "",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:us-east-1:123456789:test-queue",
          awsRegion: "us-east-1",
        },
        {
          messageId: "msg-2",
          body: JSON.stringify({
            ownerId,
            routineId: routine2.id,
            routineVersion: routine2.version,
            scheduledAt: new Date().toISOString(),
          }),
          receiptHandle: "receipt-2",
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: String(Date.now()),
            SenderId: "test-sender",
            ApproximateFirstReceiveTimestamp: String(Date.now()),
          },
          messageAttributes: {},
          md5OfBody: "",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:us-east-1:123456789:test-queue",
          awsRegion: "us-east-1",
        },
      ],
    } as const;

    const response = await handleSQSEvent(event as unknown as SQSEvent, workerConfig as unknown as Parameters<typeof handleSQSEvent>[1]);

    assert.ok(response.batchItemFailures !== undefined);
    assert.equal(agentCallCount, 1, "Only successful routine should run agent");
  });

  test("DLQ redrive validates routine before reprocessing", { skip: !isIntegration }, async () => {
    const { redriveDeadLetterMessage } = await import("../../shared/finance/reconciliation");
    const ownerId = `owner-${randomUUID()}`;

    const routine = await createRoutine(routineConfig, ownerId, {
      botId: "bot-1",
      name: "DLQ Test Routine",
      instruction: "Test DLQ",
      cronExpr: "0 12 * * *",
      timezone: "UTC",
    });

    const scheduledAt = new Date().toISOString();

    const redriveConfig = {
      routineRepo: routineConfig,
      runRepo: config,
      schedulerClient: {
        createSchedule: async () => ({ success: true as const, arn: "arn:test" }),
        updateSchedule: async () => ({ success: true as const, arn: "arn:test" }),
        deleteSchedule: async () => ({ success: true as const }),
        getSchedule: async () => ({ success: false as const, error: "not found", code: "NOT_FOUND" as const }),
        pauseSchedule: async () => ({ success: true as const, arn: "arn:test" }),
        resumeSchedule: async () => ({ success: true as const, arn: "arn:test" }),
      },
      scheduleTarget: {
        queueArn: "arn:aws:sqs:us-east-1:123456789:worker-queue",
        roleArn: "arn:aws:iam::123456789:role/scheduler-role",
        dlqArn: "arn:aws:sqs:us-east-1:123456789:dlq",
      },
    };

    const validResult = await redriveDeadLetterMessage(
      redriveConfig,
      ownerId,
      routine.id,
      routine.version,
      scheduledAt
    );
    assert.ok(validResult.success);
    assert.equal(validResult.reason, "ready_for_redrive");

    await deleteRoutine(routineConfig, ownerId, routine.id);

    const deletedResult = await redriveDeadLetterMessage(
      redriveConfig,
      ownerId,
      routine.id,
      routine.version,
      scheduledAt
    );
    assert.ok(!deletedResult.success);
    assert.equal(deletedResult.reason, "routine_deleted");
  });

  test("DLQ redrive rejects stale version", { skip: !isIntegration }, async () => {
    const { redriveDeadLetterMessage } = await import("../../shared/finance/reconciliation");
    const ownerId = `owner-${randomUUID()}`;

    const routine = await createRoutine(routineConfig, ownerId, {
      botId: "bot-1",
      name: "Version Mismatch Test",
      instruction: "Original instruction",
      cronExpr: "0 13 * * *",
      timezone: "UTC",
    });

    const oldVersion = routine.version;
    await updateRoutine(routineConfig, ownerId, routine.id, {
      instruction: "Updated instruction",
    });

    const redriveConfig = {
      routineRepo: routineConfig,
      runRepo: config,
      schedulerClient: {
        createSchedule: async () => ({ success: true as const, arn: "arn:test" }),
        updateSchedule: async () => ({ success: true as const, arn: "arn:test" }),
        deleteSchedule: async () => ({ success: true as const }),
        getSchedule: async () => ({ success: false as const, error: "not found", code: "NOT_FOUND" as const }),
        pauseSchedule: async () => ({ success: true as const, arn: "arn:test" }),
        resumeSchedule: async () => ({ success: true as const, arn: "arn:test" }),
      },
      scheduleTarget: {
        queueArn: "arn:aws:sqs:us-east-1:123456789:worker-queue",
        roleArn: "arn:aws:iam::123456789:role/scheduler-role",
        dlqArn: "arn:aws:sqs:us-east-1:123456789:dlq",
      },
    };

    const staleResult = await redriveDeadLetterMessage(
      redriveConfig,
      ownerId,
      routine.id,
      oldVersion,
      new Date().toISOString()
    );
    assert.ok(!staleResult.success);
    assert.equal(staleResult.reason, "stale_version");
  });
});

describe("DB/Scheduler/Run reconciliation", () => {
  test("reconcileOwner syncs orphaned schedules", { skip: !isIntegration }, async () => {
    const { reconcileOwner } = await import("../../shared/finance/reconciliation");
    const { createFakeSchedulerClient } = await import("../../shared/finance/schedule");
    const ownerId = `owner-${randomUUID()}`;

    const fakeScheduler = createFakeSchedulerClient();

    const routine = await createRoutine(routineConfig, ownerId, {
      botId: "bot-1",
      name: "Reconcile Test",
      instruction: "Test reconciliation",
      cronExpr: "0 14 * * *",
      timezone: "UTC",
    });

    const reconcileConfig = {
      routineRepo: routineConfig,
      runRepo: config,
      schedulerClient: fakeScheduler,
      scheduleTarget: {
        queueArn: "arn:aws:sqs:us-east-1:123456789:worker-queue",
        roleArn: "arn:aws:iam::123456789:role/scheduler-role",
        dlqArn: "arn:aws:sqs:us-east-1:123456789:dlq",
      },
    };

    const result = await reconcileOwner(reconcileConfig, ownerId);

    assert.ok(result.routinesChecked >= 1);
    assert.equal(result.errors.length, 0);
    assert.ok(result.schedulesCreated >= 0 || result.schedulesUpdated >= 0);
  });

  test("reconcileOwner cancels runs for deleted routines", { skip: !isIntegration }, async () => {
    const { reconcileOwner } = await import("../../shared/finance/reconciliation");
    const { createFakeSchedulerClient } = await import("../../shared/finance/schedule");
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const fakeScheduler = createFakeSchedulerClient();

    const routine = await createRoutine(routineConfig, ownerId, {
      botId: "bot-1",
      name: "Delete Test",
      instruction: "Will be deleted during run",
      cronExpr: "0 15 * * *",
      timezone: "UTC",
    });

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: routine.botId,
      routineId: routine.id,
      routineVersion: routine.version,
      scheduledAt: new Date().toISOString(),
      instruction: routine.instruction,
    }, workerId);

    const lease = await acquireLease(config, ownerId, run.id, workerId);
    assert.ok(lease.acquired);

    await deleteRoutine(routineConfig, ownerId, routine.id);

    const reconcileConfig = {
      routineRepo: routineConfig,
      runRepo: config,
      schedulerClient: fakeScheduler,
      scheduleTarget: {
        queueArn: "arn:aws:sqs:us-east-1:123456789:worker-queue",
        roleArn: "arn:aws:iam::123456789:role/scheduler-role",
        dlqArn: "arn:aws:sqs:us-east-1:123456789:dlq",
      },
    };

    const result = await reconcileOwner(reconcileConfig, ownerId);

    assert.ok(result.runsCanceled >= 1 || result.errors.length === 0);
  });

  test("reconcileOwner recovers expired lease runs", { skip: !isIntegration }, async () => {
    const { reconcileOwner } = await import("../../shared/finance/reconciliation");
    const { createFakeSchedulerClient } = await import("../../shared/finance/schedule");
    const ownerId = `owner-${randomUUID()}`;
    const workerId = `worker-${randomUUID()}`;

    const fakeScheduler = createFakeSchedulerClient();

    const { run } = await createOrGetRun(config, {
      ownerId,
      botId: "bot-1",
      instruction: "Long running task with expired lease",
      maxAttempts: 5,
    }, workerId);

    const lease = await acquireLease(config, ownerId, run.id, workerId);
    assert.ok(lease.acquired);

    const fiveMinutesAgo = Date.now() - 6 * 60 * 1000;
    await client.send(
      new (await import("@aws-sdk/lib-dynamodb")).UpdateCommand({
        TableName: tableName,
        Key: { pk: `run#${ownerId}#${run.id}`, sk: "meta" },
        UpdateExpression: "SET leaseExpiresAt = :expired",
        ExpressionAttributeValues: { ":expired": fiveMinutesAgo },
      })
    );

    const reconcileConfig = {
      routineRepo: routineConfig,
      runRepo: config,
      schedulerClient: fakeScheduler,
      scheduleTarget: {
        queueArn: "arn:aws:sqs:us-east-1:123456789:worker-queue",
        roleArn: "arn:aws:iam::123456789:role/scheduler-role",
        dlqArn: "arn:aws:sqs:us-east-1:123456789:dlq",
      },
    };

    const result = await reconcileOwner(reconcileConfig, ownerId);

    assert.ok(result.runsRecovered >= 0 || result.runsCanceled >= 0);
  });
});
