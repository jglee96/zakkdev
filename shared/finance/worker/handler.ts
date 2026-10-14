import "server-only";
import { randomUUID } from "node:crypto";
import type { SQSEvent, SQSBatchResponse, SQSBatchItemFailure, SQSRecord } from "aws-lambda";
import {
  type AgentRun,
  type WorkerMessage,
  WORKER_DEADLINE_MS,
  WORKER_CALL_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
} from "./types";
import {
  type RunRepositoryConfig,
  createOrGetRun,
  getRun,
  acquireLease,
  renewLease,
  commitRunCompletion,
  requeueRun,
} from "./run-repository";
import {
  type RoutineRepositoryConfig,
  getRoutine,
} from "../routine";
import type { AgentRuntimeConfig } from "../agent/runtime";
import type { AgentRunResult, Bot } from "../agent/types";
import { agentRunResultToReportData } from "./report-data";

export type WorkerConfig = {
  runRepo: RunRepositoryConfig;
  routineRepo: RoutineRepositoryConfig;
  getBot: (ownerId: string, botId: string) => Promise<Bot | null>;
  runAgent: (bot: Bot, instruction: string, config: AgentRuntimeConfig, deadline: number) => Promise<AgentRunResult>;
  createRuntimeConfig: () => AgentRuntimeConfig;
};

export type WorkerContext = {
  workerId: string;
  startedAt: number;
  deadlineAt: number;
};

export async function handleSQSEvent(
  event: SQSEvent,
  config: WorkerConfig
): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    const result = await processRecord(record, config);
    if (!result.success) {
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

async function processRecord(
  record: SQSRecord,
  config: WorkerConfig
): Promise<{ success: boolean; reason?: string }> {
  const workerId = randomUUID();
  const startedAt = Date.now();
  const deadlineAt = startedAt + WORKER_DEADLINE_MS;

  let message: WorkerMessage;
  try {
    message = JSON.parse(record.body);
  } catch {
    console.error("Invalid message body:", record.body);
    return { success: true, reason: "invalid_message" };
  }

  if (!message.ownerId || !message.routineId || typeof message.routineVersion !== "number" || !message.scheduledAt) {
    console.error("Missing required fields:", message);
    return { success: true, reason: "missing_fields" };
  }

  const routine = await getRoutine(config.routineRepo, message.ownerId, message.routineId);
  if (!routine) {
    console.log("Routine not found or deleted:", message.routineId);
    return { success: true, reason: "routine_not_found" };
  }

  if (routine.status === "deleted") {
    console.log("Routine deleted, skipping:", message.routineId);
    return { success: true, reason: "routine_deleted" };
  }

  if (routine.status === "paused") {
    console.log("Routine paused, skipping:", message.routineId);
    return { success: true, reason: "routine_paused" };
  }

  if (routine.version !== message.routineVersion) {
    console.log("Stale version, skipping:", {
      expected: message.routineVersion,
      actual: routine.version,
    });
    return { success: true, reason: "stale_version" };
  }

  const { run, created } = await createOrGetRun(config.runRepo, {
    ownerId: routine.ownerId,
    botId: routine.botId,
    routineId: message.routineId,
    routineVersion: message.routineVersion,
    scheduledAt: message.scheduledAt,
    instruction: routine.instruction,
  }, workerId);

  if (run.status === "completed" || run.status === "failed" || run.status === "canceled") {
    console.log("Run already finished:", run.id, run.status);
    return { success: true, reason: "already_finished" };
  }

  const leaseResult = await acquireLease(
    config.runRepo,
    routine.ownerId,
    run.id,
    workerId,
    message.routineVersion
  );

  if (!leaseResult.acquired) {
    console.log("Failed to acquire lease:", leaseResult.reason);
    if (leaseResult.reason === "already_running") {
      return { success: false, reason: "lease_held" };
    }
    return { success: true, reason: leaseResult.reason };
  }

  const bot = await config.getBot(routine.ownerId, routine.botId);
  if (!bot) {
    await commitRunCompletion(
      config.runRepo,
      routine.ownerId,
      run.id,
      workerId,
      leaseResult.fencingToken,
      "failed",
      undefined,
      "Bot not found",
      "BOT_NOT_FOUND"
    );
    return { success: true, reason: "bot_not_found" };
  }

  if (bot.status !== "active") {
    await commitRunCompletion(
      config.runRepo,
      routine.ownerId,
      run.id,
      workerId,
      leaseResult.fencingToken,
      "failed",
      undefined,
      `Bot is ${bot.status}`,
      "BOT_INACTIVE"
    );
    return { success: true, reason: "bot_inactive" };
  }

  const heartbeatInterval = setInterval(async () => {
    const renewResult = await renewLease(
      config.runRepo,
      routine.ownerId,
      run.id,
      workerId,
      leaseResult.fencingToken
    );
    if (!renewResult.renewed) {
      console.error("Heartbeat failed:", renewResult.reason);
      clearInterval(heartbeatInterval);
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const runtimeConfig = config.createRuntimeConfig();
    const result = await config.runAgent(bot, routine.instruction, runtimeConfig, deadlineAt);

    clearInterval(heartbeatInterval);

    const finalStatus = result.status === "completed" ? "completed" :
      result.status === "timeout" ? "timeout" : "failed";

    if (finalStatus === "completed" || result.status === "budget_exceeded") {
      const reportData = agentRunResultToReportData(result);
      const commitResult = await commitRunCompletion(
        config.runRepo,
        routine.ownerId,
        run.id,
        workerId,
        leaseResult.fencingToken,
        finalStatus,
        result.usage,
        result.error,
        result.status === "budget_exceeded" ? "BUDGET_EXCEEDED" : undefined,
        reportData
      );

      if (!commitResult.committed) {
        console.error("Failed to commit completion:", commitResult.reason);
        return { success: false, reason: "commit_failed" };
      }

      return { success: true };
    }

    if (result.status === "timeout" || result.status === "error") {
      const requeueResult = await requeueRun(
        config.runRepo,
        routine.ownerId,
        run.id,
        workerId,
        leaseResult.fencingToken,
        undefined,
        result.error
      );

      if (!requeueResult.committed) {
        return { success: false, reason: "requeue_failed" };
      }

      return { success: false, reason: "requeued" };
    }

    return { success: true };
  } catch (error) {
    clearInterval(heartbeatInterval);

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Worker error:", errorMessage);

    const requeueResult = await requeueRun(
      config.runRepo,
      routine.ownerId,
      run.id,
      workerId,
      leaseResult.fencingToken,
      undefined,
      errorMessage
    );

    if (!requeueResult.committed) {
      console.error("Failed to requeue after error:", requeueResult);
    }

    return { success: false, reason: "error" };
  }
}

