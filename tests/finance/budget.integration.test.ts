import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  getCostConfig,
  createBudgetClient,
  reserveBudget,
  settleBudget,
  releaseBudget,
  getOwnerDailyUsage,
  keepReservation,
  type CostConfig,
} from "../../shared/finance/cost";

let client: DynamoDBDocumentClient;
let rawClient: DynamoDBClient;
let config: CostConfig;
const tableName = `FinanceBudgetTest-${randomUUID()}`;

before(async () => {
  rawClient = new DynamoDBClient({
    region: "ap-northeast-2",
    endpoint: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
  await rawClient.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      BillingMode: "PAY_PER_REQUEST",
    })
  );
  client = createBudgetClient({
    NODE_ENV: "development",
    AWS_REGION: "ap-northeast-2",
    FINANCE_DYNAMODB_ENDPOINT: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
  });
  config = getCostConfig({
    FINANCE_BUDGET_TABLE: tableName,
    FINANCE_DAILY_BUDGET_USD: "10.0",
  });
  config = { ...config, tableName };
});

after(async () => {
  await rawClient.send(new DeleteTableCommand({ TableName: tableName })).catch(() => undefined);
  rawClient.destroy();
});

test("reserveBudget creates atomic reservation and tracks daily usage", async () => {
  const ownerId = `owner-${randomUUID()}`;
  const runId = `run-${randomUUID()}`;
  const now = new Date("2026-01-15T10:00:00Z");

  const result = await reserveBudget(client, config, ownerId, runId, 2.5, now);
  assert.ok(result.success);
  assert.equal(result.reservation.ownerId, ownerId);
  assert.equal(result.reservation.runId, runId);
  assert.equal(result.reservation.reservedUsd, 2.5);
  assert.equal(result.reservation.status, "reserved");
  assert.equal(result.reservation.budgetDate, "2026-01-15");

  const usage = await getOwnerDailyUsage(client, config, ownerId, now);
  assert.ok(usage);
  assert.equal(usage.spent, 0);
  assert.equal(usage.reserved, 2.5);
  assert.equal(usage.available, 7.5);
});

test("reserveBudget rejects when budget exceeded", async () => {
  const ownerId = `owner-${randomUUID()}`;
  const now = new Date("2026-01-16T10:00:00Z");

  const first = await reserveBudget(client, config, ownerId, "run-1", 8.0, now);
  assert.ok(first.success);

  const second = await reserveBudget(client, config, ownerId, "run-2", 3.0, now);
  assert.ok(!second.success);
  assert.equal(second.reason, "budget_exceeded");
  assert.equal(second.available, 2.0);
  assert.equal(second.requested, 3.0);
});

test("settleBudget converts reservation to spent and refunds excess", async () => {
  const ownerId = `owner-${randomUUID()}`;
  const runId = `run-${randomUUID()}`;
  const now = new Date("2026-01-17T10:00:00Z");

  const reservation = await reserveBudget(client, config, ownerId, runId, 5.0, now);
  assert.ok(reservation.success);

  const settle = await settleBudget(client, config, reservation.reservation.reservationId, 2.0, now);
  assert.ok(settle.success);
  assert.equal(settle.actualCost, 2.0);
  assert.equal(settle.refunded, 3.0);

  const usage = await getOwnerDailyUsage(client, config, ownerId, now);
  assert.ok(usage);
  assert.equal(usage.spent, 2.0);
  assert.equal(usage.reserved, 0);
  assert.equal(usage.available, 8.0);
});

test("settleBudget rejects double settlement", async () => {
  const ownerId = `owner-${randomUUID()}`;
  const runId = `run-${randomUUID()}`;
  const now = new Date("2026-01-18T10:00:00Z");

  const reservation = await reserveBudget(client, config, ownerId, runId, 1.0, now);
  assert.ok(reservation.success);

  const first = await settleBudget(client, config, reservation.reservation.reservationId, 0.5, now);
  assert.ok(first.success);

  const second = await settleBudget(client, config, reservation.reservation.reservationId, 0.3, now);
  assert.ok(!second.success);
  assert.equal(second.reason, "already_settled");
});

test("releaseBudget returns full reservation to available budget", async () => {
  const ownerId = `owner-${randomUUID()}`;
  const runId = `run-${randomUUID()}`;
  const now = new Date("2026-01-19T10:00:00Z");

  const reservation = await reserveBudget(client, config, ownerId, runId, 4.0, now);
  assert.ok(reservation.success);

  const usage1 = await getOwnerDailyUsage(client, config, ownerId, now);
  assert.ok(usage1);
  assert.equal(usage1.reserved, 4.0);

  const release = await releaseBudget(client, config, reservation.reservation.reservationId, now);
  assert.ok(release.success);
  assert.equal(release.actualCost, 0);
  assert.equal(release.refunded, 4.0);

  const usage2 = await getOwnerDailyUsage(client, config, ownerId, now);
  assert.ok(usage2);
  assert.equal(usage2.reserved, 0);
  assert.equal(usage2.spent, 0);
});

test("keepReservation marks reservation as unclear without settling", async () => {
  const ownerId = `owner-${randomUUID()}`;
  const runId = `run-${randomUUID()}`;
  const now = new Date("2026-01-20T10:00:00Z");

  const reservation = await reserveBudget(client, config, ownerId, runId, 3.0, now);
  assert.ok(reservation.success);

  const kept = await keepReservation(client, config, reservation.reservation.reservationId, "timeout_no_response", now);
  assert.ok(kept);

  const usage = await getOwnerDailyUsage(client, config, ownerId, now);
  assert.ok(usage);
  assert.equal(usage.reserved, 3.0);
  assert.equal(usage.spent, 0);
});

test("concurrent reservations are handled atomically", async () => {
  const ownerId = `owner-${randomUUID()}`;
  const now = new Date("2026-01-21T10:00:00Z");

  const results = await Promise.all([
    reserveBudget(client, config, ownerId, "run-1", 4.0, now),
    reserveBudget(client, config, ownerId, "run-2", 4.0, now),
    reserveBudget(client, config, ownerId, "run-3", 4.0, now),
  ]);

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  assert.ok(successes.length >= 1 && successes.length <= 2);
  assert.ok(failures.length >= 1);

  const usage = await getOwnerDailyUsage(client, config, ownerId, now);
  assert.ok(usage);
  assert.ok(usage.reserved <= 8.0);
  assert.ok(usage.available >= 2.0);
});

test("different days have separate budgets", async () => {
  const ownerId = `owner-${randomUUID()}`;
  const day1 = new Date("2026-01-22T10:00:00Z");
  const day2 = new Date("2026-01-23T10:00:00Z");

  const res1 = await reserveBudget(client, config, ownerId, "run-1", 8.0, day1);
  assert.ok(res1.success);

  const res2 = await reserveBudget(client, config, ownerId, "run-2", 8.0, day2);
  assert.ok(res2.success);

  const usage1 = await getOwnerDailyUsage(client, config, ownerId, day1);
  const usage2 = await getOwnerDailyUsage(client, config, ownerId, day2);
  
  assert.ok(usage1);
  assert.ok(usage2);
  assert.equal(usage1.reserved, 8.0);
  assert.equal(usage2.reserved, 8.0);
});

test("multiple sequential reserve/settle cycles on same owner", async () => {
  const ownerId = `owner-${randomUUID()}`;
  const now = new Date("2026-01-24T10:00:00Z");

  const res1 = await reserveBudget(client, config, ownerId, "run-1", 5.0, now);
  assert.ok(res1.success, "First reservation should succeed");
  
  const usage1 = await getOwnerDailyUsage(client, config, ownerId, now);
  assert.ok(usage1);
  assert.equal(usage1.reserved, 5.0);
  assert.equal(usage1.spent, 0);
  assert.equal(usage1.available, 5.0);

  const settle1 = await settleBudget(client, config, res1.reservation.reservationId, 0.001, now);
  assert.ok(settle1.success, "First settlement should succeed");
  
  const usageAfter1 = await getOwnerDailyUsage(client, config, ownerId, now);
  assert.ok(usageAfter1);
  assert.equal(usageAfter1.reserved, 0);
  assert.ok(Math.abs(usageAfter1.spent - 0.001) < 0.0001);
  assert.ok(usageAfter1.available > 9.9);

  const res2 = await reserveBudget(client, config, ownerId, "run-2", 5.0, now);
  assert.ok(res2.success, "Second reservation should succeed");
  
  const settle2 = await settleBudget(client, config, res2.reservation.reservationId, 0.001, now);
  assert.ok(settle2.success, "Second settlement should succeed");
  
  const usageAfter2 = await getOwnerDailyUsage(client, config, ownerId, now);
  assert.ok(usageAfter2);
  assert.equal(usageAfter2.reserved, 0);
  assert.ok(Math.abs(usageAfter2.spent - 0.002) < 0.0001);
  assert.ok(usageAfter2.available > 9.9);

  const res3 = await reserveBudget(client, config, ownerId, "run-3", 5.0, now);
  assert.ok(res3.success, `Third reservation should succeed, but got: available=${res3.success ? "N/A" : (res3 as any).available}`);
  
  const settle3 = await settleBudget(client, config, res3.reservation.reservationId, 0.001, now);
  assert.ok(settle3.success, "Third settlement should succeed");

  const usageAfter3 = await getOwnerDailyUsage(client, config, ownerId, now);
  assert.ok(usageAfter3);
  assert.equal(usageAfter3.reserved, 0);
  assert.ok(Math.abs(usageAfter3.spent - 0.003) < 0.0001);
  assert.ok(usageAfter3.available > 9.9);
});

test("regression: floating point precision does not break sequential reservations", async () => {
  const ownerId = `owner-fp-${randomUUID()}`;
  const now = new Date("2026-01-25T10:00:00Z");

  for (let i = 0; i < 5; i++) {
    const reserveResult = await reserveBudget(client, config, ownerId, `run-${i}`, 5.0, now);
    assert.ok(reserveResult.success, `Reservation ${i} should succeed`);

    const actualCost = 0.000221 * (i + 1);
    const settleResult = await settleBudget(client, config, reserveResult.reservation.reservationId, actualCost, now);
    assert.ok(settleResult.success, `Settlement ${i} should succeed`);

    const usage = await getOwnerDailyUsage(client, config, ownerId, now);
    assert.ok(usage, `Usage check ${i} should return data`);
    assert.ok(usage.available > 0, `Available budget should be positive after cycle ${i}, got ${usage.available}`);
  }

  const finalUsage = await getOwnerDailyUsage(client, config, ownerId, now);
  assert.ok(finalUsage);
  assert.equal(finalUsage.reserved, 0);
  assert.ok(finalUsage.spent > 0);
  assert.ok(finalUsage.available > 9.0);
});
