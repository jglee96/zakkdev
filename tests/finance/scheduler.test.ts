import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  createFakeSchedulerClient,
  generateSchedulerName,
} from "../../shared/finance/schedule";

describe("generateSchedulerName", () => {
  test("generates valid scheduler name", () => {
    const name = generateSchedulerName("owner-123", "routine-456");
    assert.ok(name.startsWith("fin-"));
    assert.ok(name.length <= 64);
    assert.match(name, /^[a-zA-Z0-9-]+$/);
  });

  test("uses prefix of owner and routine IDs", () => {
    const name = generateSchedulerName("abcd1234-full-owner-id", "efgh5678-full-routine-id");
    assert.equal(name, "fin-abcd1234-efgh5678");
  });
});

describe("FakeSchedulerClient", () => {
  test("creates schedule successfully", async () => {
    const client = createFakeSchedulerClient();

    const result = await client.createSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 16 * * *)",
      timezone: "Asia/Seoul",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    assert.ok(result.success);
    assert.ok(result.arn.includes("test-schedule"));

    const schedules = client.getSchedules();
    assert.equal(schedules.size, 1);
    assert.ok(schedules.has("test-schedule"));
  });

  test("rejects duplicate schedule name", async () => {
    const client = createFakeSchedulerClient();

    await client.createSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 16 * * *)",
      timezone: "Asia/Seoul",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    const result = await client.createSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 17 * * *)",
      timezone: "Asia/Seoul",
      input: { ownerId: "owner-1", routineId: "routine-2", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    assert.ok(!result.success);
    assert.equal(result.code, "CONFLICT");
  });

  test("simulates conflict on create when option is set", async () => {
    const client = createFakeSchedulerClient({ simulateConflictOnCreate: true });

    const result = await client.createSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 16 * * *)",
      timezone: "Asia/Seoul",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    assert.ok(!result.success);
    assert.equal(result.code, "CONFLICT");
  });

  test("simulates limit exceeded on create when option is set", async () => {
    const client = createFakeSchedulerClient({ simulateLimitOnCreate: true });

    const result = await client.createSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 16 * * *)",
      timezone: "Asia/Seoul",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    assert.ok(!result.success);
    assert.equal(result.code, "LIMIT");
  });

  test("updates schedule successfully", async () => {
    const client = createFakeSchedulerClient();

    await client.createSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 16 * * *)",
      timezone: "Asia/Seoul",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    const result = await client.updateSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 17 * * *)",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 2 },
    });

    assert.ok(result.success);

    const schedule = client.getSchedules().get("test-schedule");
    assert.equal(schedule?.scheduleExpression, "cron(0 17 * * *)");
    assert.equal(schedule?.input.routineVersion, 2);
  });

  test("returns NOT_FOUND when updating non-existent schedule", async () => {
    const client = createFakeSchedulerClient();

    const result = await client.updateSchedule({
      name: "non-existent",
      scheduleExpression: "cron(0 17 * * *)",
    });

    assert.ok(!result.success);
    assert.equal(result.code, "NOT_FOUND");
  });

  test("deletes schedule successfully", async () => {
    const client = createFakeSchedulerClient();

    await client.createSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 16 * * *)",
      timezone: "Asia/Seoul",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    const result = await client.deleteSchedule("test-schedule");

    assert.ok(result.success);
    assert.equal(client.getSchedules().size, 0);
  });

  test("deleteSchedule succeeds for non-existent schedule", async () => {
    const client = createFakeSchedulerClient();

    const result = await client.deleteSchedule("non-existent");

    assert.ok(result.success);
  });

  test("gets schedule successfully", async () => {
    const client = createFakeSchedulerClient();

    await client.createSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 16 * * *)",
      timezone: "Asia/Seoul",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    const result = await client.getSchedule("test-schedule");

    assert.ok(result.success);
    assert.equal(result.schedule.name, "test-schedule");
    assert.equal(result.schedule.scheduleExpression, "cron(0 16 * * *)");
    assert.equal(result.schedule.timezone, "Asia/Seoul");
    assert.equal(result.schedule.state, "ENABLED");
  });

  test("returns NOT_FOUND for non-existent schedule", async () => {
    const client = createFakeSchedulerClient();

    const result = await client.getSchedule("non-existent");

    assert.ok(!result.success);
    assert.equal(result.code, "NOT_FOUND");
  });

  test("pauses schedule successfully", async () => {
    const client = createFakeSchedulerClient();

    await client.createSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 16 * * *)",
      timezone: "Asia/Seoul",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    const result = await client.pauseSchedule("test-schedule");

    assert.ok(result.success);

    const schedule = client.getSchedules().get("test-schedule");
    assert.equal(schedule?.state, "DISABLED");
  });

  test("resumes schedule successfully", async () => {
    const client = createFakeSchedulerClient();

    await client.createSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 16 * * *)",
      timezone: "Asia/Seoul",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    await client.pauseSchedule("test-schedule");
    const result = await client.resumeSchedule("test-schedule");

    assert.ok(result.success);

    const schedule = client.getSchedules().get("test-schedule");
    assert.equal(schedule?.state, "ENABLED");
  });

  test("triggerSchedule returns message data for enabled schedule", async () => {
    const client = createFakeSchedulerClient();

    await client.createSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 16 * * *)",
      timezone: "Asia/Seoul",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    const message = client.triggerSchedule("test-schedule");

    assert.ok(message);
    assert.equal(message.routineId, "routine-1");
    assert.equal(message.routineVersion, 1);
    assert.ok(message.scheduledAt);
  });

  test("triggerSchedule returns null for disabled schedule", async () => {
    const client = createFakeSchedulerClient();

    await client.createSchedule({
      name: "test-schedule",
      scheduleExpression: "cron(0 16 * * *)",
      timezone: "Asia/Seoul",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    await client.pauseSchedule("test-schedule");

    const message = client.triggerSchedule("test-schedule");

    assert.equal(message, null);
  });

  test("clearSchedules removes all schedules", async () => {
    const client = createFakeSchedulerClient();

    await client.createSchedule({
      name: "test-1",
      scheduleExpression: "cron(0 16 * * *)",
      timezone: "UTC",
      input: { ownerId: "owner-1", routineId: "routine-1", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    await client.createSchedule({
      name: "test-2",
      scheduleExpression: "cron(0 17 * * *)",
      timezone: "UTC",
      input: { ownerId: "owner-1", routineId: "routine-2", routineVersion: 1 },
      target: { queueArn: "arn:sqs", roleArn: "arn:role", dlqArn: "arn:dlq" },
    });

    assert.equal(client.getSchedules().size, 2);

    client.clearSchedules();

    assert.equal(client.getSchedules().size, 0);
  });
});
