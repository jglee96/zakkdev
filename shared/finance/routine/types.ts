import "server-only";

export type RoutineStatus = "pending" | "active" | "paused" | "deleted";

export type Routine = {
  readonly id: string;
  readonly ownerId: string;
  readonly botId: string;
  readonly name: string;
  readonly instruction: string;
  readonly cronExpr: string;
  readonly timezone: string;
  readonly status: RoutineStatus;
  readonly version: number;
  readonly schedulerName?: string;
  readonly schedulerArn?: string;
  readonly lastScheduledAt?: string;
  readonly nextScheduledAt?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly deletedAt?: number;
};

export type CreateRoutineInput = {
  botId: string;
  name: string;
  instruction: string;
  cronExpr: string;
  timezone: string;
};

export type UpdateRoutineInput = {
  name?: string;
  instruction?: string;
  cronExpr?: string;
  timezone?: string;
  status?: "active" | "paused";
};

export const VALID_TIMEZONES = [
  "Asia/Seoul",
  "Asia/Tokyo",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "UTC",
] as const;

export type ValidTimezone = (typeof VALID_TIMEZONES)[number];

export const MAX_ROUTINES_PER_OWNER = 10;
export const MAX_ROUTINES_PER_BOT = 5;

export function isValidTimezone(tz: string): tz is ValidTimezone {
  return VALID_TIMEZONES.includes(tz as ValidTimezone);
}

const CRON_FIELD_RANGES = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dayOfWeek: { min: 0, max: 6 },
} as const;

export type CronValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; error: string };

export function validateCronExpression(expr: string): CronValidationResult {
  const trimmed = expr.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length !== 5) {
    return {
      valid: false,
      error: `Cron expression must have 5 fields (minute hour day-of-month month day-of-week), got ${parts.length}`,
    };
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const fields = [
    { name: "minute", value: minute, ...CRON_FIELD_RANGES.minute },
    { name: "hour", value: hour, ...CRON_FIELD_RANGES.hour },
    { name: "dayOfMonth", value: dayOfMonth, ...CRON_FIELD_RANGES.dayOfMonth },
    { name: "month", value: month, ...CRON_FIELD_RANGES.month },
    { name: "dayOfWeek", value: dayOfWeek, ...CRON_FIELD_RANGES.dayOfWeek },
  ] as const;

  for (const field of fields) {
    const result = validateCronField(field.value, field.name, field.min, field.max);
    if (!result.valid) {
      return result;
    }
  }

  const normalized = parts.join(" ");
  return { valid: true, normalized };
}

function validateCronField(
  value: string,
  fieldName: string,
  min: number,
  max: number
): CronValidationResult {
  if (value === "*") {
    return { valid: true, normalized: value };
  }

  if (value.includes(",")) {
    const subValues = value.split(",");
    for (const sub of subValues) {
      const result = validateCronFieldSingle(sub.trim(), fieldName, min, max);
      if (!result.valid) return result;
    }
    return { valid: true, normalized: value };
  }

  return validateCronFieldSingle(value, fieldName, min, max);
}

function validateCronFieldSingle(
  value: string,
  fieldName: string,
  min: number,
  max: number
): CronValidationResult {
  if (value.includes("/")) {
    const [range, step] = value.split("/");
    if (range !== "*") {
      const rangeResult = validateCronRange(range, fieldName, min, max);
      if (!rangeResult.valid) return rangeResult;
    }
    const stepNum = parseInt(step, 10);
    if (isNaN(stepNum) || stepNum < 1 || stepNum > max) {
      return { valid: false, error: `Invalid step value '${step}' in ${fieldName}` };
    }
    return { valid: true, normalized: value };
  }

  if (value.includes("-")) {
    return validateCronRange(value, fieldName, min, max);
  }

  const num = parseInt(value, 10);
  if (isNaN(num) || num < min || num > max) {
    return { valid: false, error: `Invalid value '${value}' in ${fieldName}, must be ${min}-${max}` };
  }

  return { valid: true, normalized: value };
}

function validateCronRange(
  value: string,
  fieldName: string,
  min: number,
  max: number
): CronValidationResult {
  const [startStr, endStr] = value.split("-");
  const start = parseInt(startStr, 10);
  const end = parseInt(endStr, 10);

  if (isNaN(start) || isNaN(end)) {
    return { valid: false, error: `Invalid range '${value}' in ${fieldName}` };
  }

  if (start < min || start > max || end < min || end > max) {
    return { valid: false, error: `Range '${value}' out of bounds in ${fieldName} (${min}-${max})` };
  }

  if (start > end) {
    return { valid: false, error: `Invalid range '${value}' in ${fieldName}: start > end` };
  }

  return { valid: true, normalized: value };
}

export function cronToAwsScheduleExpression(cronExpr: string): string {
  const normalized = validateCronExpression(cronExpr);
  if (!normalized.valid) {
    throw new Error(normalized.error);
  }
  return `cron(${normalized.normalized})`;
}
