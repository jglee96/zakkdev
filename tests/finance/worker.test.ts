import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  generateIdempotencyKey,
  parseIdempotencyKey,
  LEASE_DURATION_MS,
  HEARTBEAT_INTERVAL_MS,
  WORKER_DEADLINE_MS,
  WORKER_CALL_TIMEOUT_MS,
  MAX_ATTEMPTS,
} from "../../shared/finance/worker/types";

describe("generateIdempotencyKey", () => {
  test("generates correct format", () => {
    const key = generateIdempotencyKey("routine-123", 5, "2026-10-12T16:00:00Z");
    assert.equal(key, "routine-123#5#2026-10-12T16:00:00Z");
  });

  test("handles special characters in routineId", () => {
    const key = generateIdempotencyKey("routine_with-special.chars", 1, "2026-10-12T00:00:00Z");
    assert.equal(key, "routine_with-special.chars#1#2026-10-12T00:00:00Z");
  });
});

describe("parseIdempotencyKey", () => {
  test("parses valid key", () => {
    const result = parseIdempotencyKey("routine-123#5#2026-10-12T16:00:00Z");
    assert.ok(result);
    assert.equal(result.routineId, "routine-123");
    assert.equal(result.routineVersion, 5);
    assert.equal(result.scheduledAt, "2026-10-12T16:00:00Z");
  });

  test("returns null for invalid key format", () => {
    assert.equal(parseIdempotencyKey("invalid"), null);
    assert.equal(parseIdempotencyKey("only#two"), null);
    assert.equal(parseIdempotencyKey(""), null);
  });

  test("returns null for non-numeric version", () => {
    assert.equal(parseIdempotencyKey("routine#abc#2026-10-12T16:00:00Z"), null);
  });

  test("roundtrip: generate then parse", () => {
    const original = {
      routineId: "test-routine",
      routineVersion: 42,
      scheduledAt: "2026-10-12T16:00:00Z",
    };

    const key = generateIdempotencyKey(
      original.routineId,
      original.routineVersion,
      original.scheduledAt
    );

    const parsed = parseIdempotencyKey(key);

    assert.deepEqual(parsed, original);
  });
});

describe("Worker constants", () => {
  test("LEASE_DURATION_MS is 60 seconds", () => {
    assert.equal(LEASE_DURATION_MS, 60000);
  });

  test("HEARTBEAT_INTERVAL_MS is 20 seconds", () => {
    assert.equal(HEARTBEAT_INTERVAL_MS, 20000);
  });

  test("WORKER_DEADLINE_MS is 120 seconds", () => {
    assert.equal(WORKER_DEADLINE_MS, 120000);
  });

  test("WORKER_CALL_TIMEOUT_MS is 40 seconds", () => {
    assert.equal(WORKER_CALL_TIMEOUT_MS, 40000);
  });

  test("MAX_ATTEMPTS is 5", () => {
    assert.equal(MAX_ATTEMPTS, 5);
  });

  test("heartbeat interval is less than lease duration", () => {
    assert.ok(HEARTBEAT_INTERVAL_MS < LEASE_DURATION_MS);
    assert.ok(HEARTBEAT_INTERVAL_MS * 2 < LEASE_DURATION_MS);
  });

  test("call timeout fits within deadline with margin", () => {
    assert.ok(WORKER_CALL_TIMEOUT_MS < WORKER_DEADLINE_MS);
    assert.ok(WORKER_CALL_TIMEOUT_MS * 2 < WORKER_DEADLINE_MS);
  });
});
