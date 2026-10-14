import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomUUID } from "node:crypto";
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  createFakeSchedulerClient,
  resetFakeSchedulerForTests,
} from "../../shared/finance/schedule";
import {
  createRoutineWithScheduler,
  getRoutine,
  deleteRoutineWithScheduler,
  pauseRoutineWithScheduler,
} from "../../shared/finance/routine";

const isIntegration = process.env.TEST_TYPE === "integration";
const tableName = `RoutineOrchestratorTest-${randomUUID()}`;

let rawClient: DynamoDBClient;
let client: DynamoDBDocumentClient;

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
    }),
  );

  client = DynamoDBDocumentClient.from(rawClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
});

after(async () => {
  if (!isIntegration) return;
  await rawClient.send(new DeleteTableCommand({ TableName: tableName })).catch(() => undefined);
  rawClient.destroy();
});

describe("routine orchestrator integration", () => {
  test("createRoutineWithScheduler activates routine and registers fake schedule", { skip: !isIntegration }, async () => {
    resetFakeSchedulerForTests();
    const scheduler = createFakeSchedulerClient();
    const ownerId = `owner-${randomUUID()}`;
    const config = {
      routineRepo: { tableName, client },
      schedulerClient: scheduler,
      scheduleTarget: {
        queueArn: "arn:aws:sqs:local:000000000000:finance-worker-queue",
        roleArn: "arn:aws:iam::000000000000:role/scheduler",
        dlqArn: "arn:aws:sqs:local:000000000000:scheduler-dlq",
      },
    };

    const created = await createRoutineWithScheduler(config, ownerId, {
      botId: "bot-1",
      name: "Morning scan",
      instruction: "Scan market",
      cronExpr: "0 9 * * 1-5",
      timezone: "Asia/Seoul",
    });

    assert.ok(created.success);
    if (!created.success) return;

    assert.equal(created.data.status, "active");
    assert.ok(created.data.schedulerName);
    assert.equal(scheduler.getSchedules().size, 1);

    const paused = await pauseRoutineWithScheduler(config, ownerId, created.data.id);
    assert.ok(paused.success);

    const deleted = await deleteRoutineWithScheduler(config, ownerId, created.data.id);
    assert.ok(deleted.success);
    assert.equal(scheduler.getSchedules().size, 0);

    const row = await getRoutine({ tableName, client }, ownerId, created.data.id);
    assert.equal(row?.status, "deleted");
  });
});
