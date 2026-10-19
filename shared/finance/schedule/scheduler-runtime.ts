import "server-only";
import type { SchedulerClient, ScheduleTarget } from "./types";
import { createAWSSchedulerClient } from "./aws-scheduler";
import { createFakeSchedulerClient } from "./fake-scheduler";
import { createNoopSchedulerClient } from "./noop-scheduler";

export type FinanceSchedulerMode = "aws" | "fake" | "noop" | "off" | "auto";

export type ResolvedFinanceSchedulerMode = Exclude<FinanceSchedulerMode, "auto">;

export class SchedulerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulerConfigurationError";
  }
}

const FAKE_TARGET: ScheduleTarget = {
  queueArn: "arn:aws:sqs:ap-northeast-2:000000000000:finance-worker-queue-fake",
  roleArn: "arn:aws:iam::000000000000:role/finance-scheduler-fake",
  dlqArn: "arn:aws:sqs:ap-northeast-2:000000000000:finance-scheduler-dlq-fake",
};

let sharedFakeScheduler: ReturnType<typeof createFakeSchedulerClient> | undefined;

export function resetFakeSchedulerForTests() {
  sharedFakeScheduler = undefined;
}

function getSharedFakeScheduler() {
  sharedFakeScheduler ??= createFakeSchedulerClient();
  return sharedFakeScheduler;
}

export function resolveFinanceSchedulerMode(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): ResolvedFinanceSchedulerMode {
  const raw = (env.FINANCE_SCHEDULER_MODE || "auto").toLowerCase();
  if (raw === "aws" || raw === "fake" || raw === "noop" || raw === "off") {
    return raw;
  }
  if (raw !== "auto") {
    throw new SchedulerConfigurationError(`Invalid FINANCE_SCHEDULER_MODE: ${raw}`);
  }
  if (
    env.FINANCE_SCHEDULER_TARGET_QUEUE_ARN &&
    env.FINANCE_SCHEDULER_ROLE_ARN &&
    env.FINANCE_SCHEDULER_TARGET_DLQ_ARN
  ) {
    return "aws";
  }
  if (env.FINANCE_DYNAMODB_ENDPOINT) {
    return "fake";
  }
  return "off";
}

/** True for Vercel production or non-local NODE_ENV=production without DynamoDB Local. */
export function isFinanceProductionRuntime(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): boolean {
  const vercelEnv = env.VERCEL_ENV;
  if (vercelEnv === "production") {
    return true;
  }
  if (vercelEnv === "preview" || vercelEnv === "development") {
    return false;
  }
  if (env.FINANCE_DYNAMODB_ENDPOINT) {
    return false;
  }
  return env.NODE_ENV === "production";
}

/**
 * Production must use real AWS Scheduler. Prevents silent `off`/`fake`/`noop` and pending-only routines.
 */
export function assertFinanceSchedulerProductionConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): void {
  if (!isFinanceProductionRuntime(env)) {
    return;
  }

  const raw = (env.FINANCE_SCHEDULER_MODE || "auto").toLowerCase();
  if (raw === "fake" || raw === "noop" || raw === "off") {
    throw new SchedulerConfigurationError(
      `FINANCE_SCHEDULER_MODE=${raw} is not allowed in production. Set FINANCE_SCHEDULER_MODE=aws and configure scheduler target ARNs.`,
    );
  }

  const resolved = resolveFinanceSchedulerMode(env);
  if (resolved !== "aws") {
    throw new SchedulerConfigurationError(
      "Production finance requires AWS EventBridge Scheduler. Set FINANCE_SCHEDULER_MODE=aws and FINANCE_SCHEDULER_TARGET_QUEUE_ARN, FINANCE_SCHEDULER_TARGET_DLQ_ARN, and FINANCE_SCHEDULER_ROLE_ARN.",
    );
  }

  const target = getScheduleTargetFromEnv(env);
  if (!target) {
    throw new SchedulerConfigurationError(
      "Production scheduler target ARNs are incomplete. Set queue, DLQ, and role ARNs from the finance-worker stack outputs.",
    );
  }
}

export function shouldUseRoutineOrchestrator(mode: FinanceSchedulerMode): boolean {
  return mode !== "off";
}

export function getScheduleTargetFromEnv(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): ScheduleTarget | null {
  const queueArn = env.FINANCE_SCHEDULER_TARGET_QUEUE_ARN;
  const roleArn = env.FINANCE_SCHEDULER_ROLE_ARN;
  const dlqArn = env.FINANCE_SCHEDULER_TARGET_DLQ_ARN;
  if (!queueArn || !roleArn || !dlqArn) {
    return null;
  }
  return { queueArn, roleArn, dlqArn };
}

export function createSchedulerClientFromEnv(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): SchedulerClient {
  const mode = resolveFinanceSchedulerMode(env);
  switch (mode) {
    case "aws":
      return createAWSSchedulerClient({
        region: env.AWS_REGION || env.AWS_DEFAULT_REGION || "ap-northeast-2",
        groupName: env.FINANCE_SCHEDULER_GROUP_NAME || "finance-routines",
        env,
      });
    case "fake":
      return getSharedFakeScheduler();
    case "noop":
      return createNoopSchedulerClient();
    case "off":
      throw new SchedulerConfigurationError("Scheduler client requested while FINANCE_SCHEDULER_MODE=off");
    default: {
      const never: never = mode;
      throw new SchedulerConfigurationError(`Unhandled scheduler mode: ${never}`);
    }
  }
}

export function getScheduleTargetForMode(
  mode: ResolvedFinanceSchedulerMode,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): ScheduleTarget {
  if (mode === "aws") {
    const target = getScheduleTargetFromEnv(env);
    if (!target) {
      throw new SchedulerConfigurationError(
        "AWS scheduler mode requires FINANCE_SCHEDULER_TARGET_QUEUE_ARN, FINANCE_SCHEDULER_ROLE_ARN, and FINANCE_SCHEDULER_TARGET_DLQ_ARN",
      );
    }
    return target;
  }
  return FAKE_TARGET;
}
