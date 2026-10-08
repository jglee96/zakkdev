import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { CreateTableCommand, DeleteTableCommand } from "@aws-sdk/client-dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { consumeLoginAttempt, createRateLimitClient } from "../../shared/finance/auth/rate-limit";

const localEnv = { NODE_ENV: "test" as const, AWS_REGION: "ap-northeast-2", FINANCE_DYNAMODB_ENDPOINT: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000" };

test("real DynamoDB transactions enforce IP/global limits across independent clients and reset windows", async () => {
  const clients = Array.from({ length: 3 }, () => createRateLimitClient(localEnv));
  const table = `FinanceAuthTest-${randomUUID()}`;
  await clients[0].send(new CreateTableCommand({ TableName: table, AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }], KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }], BillingMode: "PAY_PER_REQUEST" }));
  const now = new Date("2026-01-01T00:01:00Z");
  const bucket = Math.floor(now.getTime() / 1000 / 900);
  try {
    const outcomes = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => consumeLoginAttempt(clients[i % 3], table, "same-ip", now)));
    const successes = outcomes.filter((r) => r.status === "fulfilled" && r.value.allowed).length;
    assert.ok(successes >= 1 && successes <= 5, `Admitted ${successes} requests`);
    const stored = await clients[0].send(new GetCommand({ TableName: table, Key: { pk: `ip#same-ip#${bucket}` }, ConsistentRead: true }));
    assert.equal(stored.Item?.attempts, successes);
    for (let count = successes; count < 5; count++) assert.equal((await consumeLoginAttempt(clients[1], table, "same-ip", now)).allowed, true);
    const denied = await consumeLoginAttempt(clients[2], table, "same-ip", now);
    assert.equal(denied.allowed, false);
    assert.equal(denied.retryAfter, 840);
    // A rejected IP transaction must not consume the shared global counter.
    const global = await clients[0].send(new GetCommand({ TableName: table, Key: { pk: `global#${bucket}` }, ConsistentRead: true }));
    assert.equal(global.Item?.attempts, 5);
    for (let i = 0; i < 25; i++) assert.equal((await consumeLoginAttempt(clients[i % 3], table, `distinct-${i}`, now)).allowed, true);
    assert.equal((await consumeLoginAttempt(clients[2], table, "fresh-ip", now)).allowed, false);
    const noPartialWrite = await clients[0].send(new GetCommand({ TableName: table, Key: { pk: `ip#fresh-ip#${bucket}` }, ConsistentRead: true }));
    assert.equal(noPartialWrite.Item, undefined);
    assert.equal((await consumeLoginAttempt(clients[1], table, "same-ip", new Date("2026-01-01T00:15:00Z"))).allowed, true);
    // TTL is cleanup only: counters still enforce limits while expired rows remain.
    await clients[0].send(new UpdateCommand({ TableName: table, Key: { pk: `global#${bucket + 1}` }, UpdateExpression: "SET expiresAt = :past, attempts = :max", ExpressionAttributeValues: { ":past": 0, ":max": 30 } }));
    assert.equal((await consumeLoginAttempt(clients[2], table, "another-ip", new Date("2026-01-01T00:15:00Z"))).allowed, false);
    await assert.rejects(consumeLoginAttempt(clients[0], `${table}-missing`, "test", now));
  } finally {
    await clients[0].send(new DeleteTableCommand({ TableName: table }));
    clients.forEach((client) => client.destroy());
  }
});
