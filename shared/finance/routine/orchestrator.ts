import "server-only";
import { randomUUID } from "node:crypto";
import type {
  Routine,
  CreateRoutineInput,
  UpdateRoutineInput,
} from "./types";
import { cronToAwsScheduleExpression } from "./types";
import {
  type RoutineRepositoryConfig,
  createRoutine,
  getRoutine,
  updateRoutine,
  deleteRoutine,
  activateRoutine,
  RoutineValidationError,
  RoutineVersionConflictError,
} from "./repository";
import type {
  SchedulerClient,
  ScheduleTarget,
} from "../schedule/types";
import { generateSchedulerName } from "../schedule/types";

export type RoutineOrchestratorConfig = {
  routineRepo: RoutineRepositoryConfig;
  schedulerClient: SchedulerClient;
  scheduleTarget: ScheduleTarget;
};

export type OrchestratorResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

export async function createRoutineWithScheduler(
  config: RoutineOrchestratorConfig,
  ownerId: string,
  input: CreateRoutineInput
): Promise<OrchestratorResult<Routine>> {
  const routine = await createRoutine(config.routineRepo, ownerId, input);

  const schedulerName = generateSchedulerName(ownerId, routine.id);
  const scheduleExpression = cronToAwsScheduleExpression(routine.cronExpr);
  const clientToken = randomUUID();

  const scheduleResult = await config.schedulerClient.createSchedule({
    name: schedulerName,
    scheduleExpression,
    timezone: routine.timezone,
    input: {
      ownerId,
      routineId: routine.id,
      routineVersion: routine.version,
    },
    target: config.scheduleTarget,
    clientToken,
  });

  if (!scheduleResult.success) {
    try {
      await deleteRoutine(config.routineRepo, ownerId, routine.id);
    } catch {
      // Best effort cleanup
    }
    return {
      success: false,
      error: `Failed to create schedule: ${scheduleResult.error}`,
      code: scheduleResult.code,
    };
  }

  try {
    const activatedRoutine = await activateRoutine(
      config.routineRepo,
      ownerId,
      routine.id,
      schedulerName,
      scheduleResult.arn
    );
    return { success: true, data: activatedRoutine };
  } catch (error) {
    await config.schedulerClient.deleteSchedule(schedulerName);

    if (error instanceof RoutineVersionConflictError) {
      return { success: false, error: "Routine was modified concurrently", code: "CONFLICT" };
    }
    throw error;
  }
}

export async function updateRoutineWithScheduler(
  config: RoutineOrchestratorConfig,
  ownerId: string,
  routineId: string,
  input: UpdateRoutineInput
): Promise<OrchestratorResult<Routine>> {
  const existing = await getRoutine(config.routineRepo, ownerId, routineId);
  if (!existing) {
    return { success: false, error: "Routine not found", code: "NOT_FOUND" };
  }

  if (existing.status === "deleted") {
    return { success: false, error: "Cannot update deleted routine", code: "DELETED" };
  }

  const updatedRoutine = await updateRoutine(
    config.routineRepo,
    ownerId,
    routineId,
    input,
    existing.version
  );

  if (!existing.schedulerName) {
    return { success: true, data: updatedRoutine };
  }

  const needsSchedulerUpdate = input.cronExpr || input.timezone || input.status;
  if (!needsSchedulerUpdate) {
    return { success: true, data: updatedRoutine };
  }

  if (input.status === "paused") {
    const pauseResult = await config.schedulerClient.pauseSchedule(existing.schedulerName);
    if (!pauseResult.success && pauseResult.code !== "NOT_FOUND") {
      return {
        success: false,
        error: `Failed to pause schedule: ${pauseResult.error}`,
        code: pauseResult.code,
      };
    }
  } else if (input.status === "active" && existing.status === "paused") {
    const resumeResult = await config.schedulerClient.resumeSchedule(existing.schedulerName);
    if (!resumeResult.success && resumeResult.code !== "NOT_FOUND") {
      return {
        success: false,
        error: `Failed to resume schedule: ${resumeResult.error}`,
        code: resumeResult.code,
      };
    }
  }

  if (input.cronExpr || input.timezone) {
    const scheduleExpression = cronToAwsScheduleExpression(
      input.cronExpr || existing.cronExpr
    );

    const updateResult = await config.schedulerClient.updateSchedule({
      name: existing.schedulerName,
      scheduleExpression,
      timezone: input.timezone || existing.timezone,
      input: {
        ownerId,
        routineId,
        routineVersion: updatedRoutine.version,
      },
    });

    if (!updateResult.success && updateResult.code !== "NOT_FOUND") {
      return {
        success: false,
        error: `Failed to update schedule: ${updateResult.error}`,
        code: updateResult.code,
      };
    }
  }

  return { success: true, data: updatedRoutine };
}

export async function deleteRoutineWithScheduler(
  config: RoutineOrchestratorConfig,
  ownerId: string,
  routineId: string
): Promise<OrchestratorResult<Routine>> {
  const existing = await getRoutine(config.routineRepo, ownerId, routineId);
  if (!existing) {
    return { success: false, error: "Routine not found", code: "NOT_FOUND" };
  }

  if (existing.status === "deleted") {
    return { success: true, data: existing };
  }

  const deletedRoutine = await deleteRoutine(
    config.routineRepo,
    ownerId,
    routineId,
    existing.version
  );

  if (existing.schedulerName) {
    const deleteResult = await config.schedulerClient.deleteSchedule(existing.schedulerName);
    if (!deleteResult.success && deleteResult.code !== "NOT_FOUND") {
      console.error("Failed to delete schedule:", deleteResult.error);
    }
  }

  return { success: true, data: deletedRoutine };
}

export async function pauseRoutineWithScheduler(
  config: RoutineOrchestratorConfig,
  ownerId: string,
  routineId: string
): Promise<OrchestratorResult<Routine>> {
  return updateRoutineWithScheduler(config, ownerId, routineId, { status: "paused" });
}

export async function resumeRoutineWithScheduler(
  config: RoutineOrchestratorConfig,
  ownerId: string,
  routineId: string
): Promise<OrchestratorResult<Routine>> {
  return updateRoutineWithScheduler(config, ownerId, routineId, { status: "active" });
}
