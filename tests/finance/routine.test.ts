import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  validateCronExpression,
  isValidTimezone,
  cronToAwsScheduleExpression,
  VALID_TIMEZONES,
} from "../../shared/finance/routine/types";

describe("validateCronExpression", () => {
  test("accepts valid 5-field cron expression", () => {
    const result = validateCronExpression("0 16 * * 1-5");
    assert.ok(result.valid);
    assert.equal(result.normalized, "0 16 * * 1-5");
  });

  test("accepts cron with wildcards", () => {
    const result = validateCronExpression("* * * * *");
    assert.ok(result.valid);
    assert.equal(result.normalized, "* * * * *");
  });

  test("accepts cron with step values", () => {
    const result = validateCronExpression("*/15 * * * *");
    assert.ok(result.valid);
    assert.equal(result.normalized, "*/15 * * * *");
  });

  test("accepts cron with comma-separated values", () => {
    const result = validateCronExpression("0 9,12,18 * * *");
    assert.ok(result.valid);
    assert.equal(result.normalized, "0 9,12,18 * * *");
  });

  test("accepts cron with range values", () => {
    const result = validateCronExpression("0 9-17 * * 1-5");
    assert.ok(result.valid);
    assert.equal(result.normalized, "0 9-17 * * 1-5");
  });

  test("rejects cron with wrong number of fields", () => {
    const result = validateCronExpression("0 16 * *");
    assert.ok(!result.valid);
    assert.ok(result.error.includes("5 fields"));
  });

  test("rejects cron with invalid minute", () => {
    const result = validateCronExpression("60 16 * * *");
    assert.ok(!result.valid);
    assert.ok(result.error.includes("minute"));
  });

  test("rejects cron with invalid hour", () => {
    const result = validateCronExpression("0 24 * * *");
    assert.ok(!result.valid);
    assert.ok(result.error.includes("hour"));
  });

  test("rejects cron with invalid day of month", () => {
    const result = validateCronExpression("0 16 32 * *");
    assert.ok(!result.valid);
    assert.ok(result.error.includes("dayOfMonth"));
  });

  test("rejects cron with invalid month", () => {
    const result = validateCronExpression("0 16 * 13 *");
    assert.ok(!result.valid);
    assert.ok(result.error.includes("month"));
  });

  test("rejects cron with invalid day of week", () => {
    const result = validateCronExpression("0 16 * * 7");
    assert.ok(!result.valid);
    assert.ok(result.error.includes("dayOfWeek"));
  });

  test("rejects cron with invalid range (start > end)", () => {
    const result = validateCronExpression("0 16 * * 5-1");
    assert.ok(!result.valid);
    assert.ok(result.error.includes("start > end"));
  });

  test("trims whitespace from expression", () => {
    const result = validateCronExpression("  0  16  *  *  *  ");
    assert.ok(result.valid);
    assert.equal(result.normalized, "0 16 * * *");
  });
});

describe("isValidTimezone", () => {
  test("accepts valid timezones", () => {
    for (const tz of VALID_TIMEZONES) {
      assert.ok(isValidTimezone(tz), `${tz} should be valid`);
    }
  });

  test("rejects invalid timezone", () => {
    assert.ok(!isValidTimezone("Invalid/Timezone"));
    assert.ok(!isValidTimezone("America/Invalid"));
    assert.ok(!isValidTimezone(""));
  });
});

describe("cronToAwsScheduleExpression", () => {
  test("converts valid cron to AWS schedule expression", () => {
    const result = cronToAwsScheduleExpression("0 16 * * 1-5");
    assert.equal(result, "cron(0 16 * * 1-5)");
  });

  test("throws on invalid cron expression", () => {
    assert.throws(() => cronToAwsScheduleExpression("invalid"));
  });
});

describe("Routine limits", () => {
  test("MAX_ROUTINES_PER_OWNER is 10", async () => {
    const { MAX_ROUTINES_PER_OWNER } = await import("../../shared/finance/routine/types");
    assert.equal(MAX_ROUTINES_PER_OWNER, 10);
  });

  test("MAX_ROUTINES_PER_BOT is 5", async () => {
    const { MAX_ROUTINES_PER_BOT } = await import("../../shared/finance/routine/types");
    assert.equal(MAX_ROUTINES_PER_BOT, 5);
  });
});
