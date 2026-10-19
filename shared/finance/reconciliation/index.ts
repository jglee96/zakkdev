import "server-only";
import type { RoutineRepositoryConfig, Routine } from "../routine";
import { listRoutinesByOwner, deleteRoutine, activateRoutine, cronToAwsScheduleExpression } from "../routine";
import type { SchedulerClient, ScheduleInfo } from "../schedule";
import { generateSchedulerName } from "../schedule";
import type { RunRepositoryConfig, AgentRun } from "../worker";
import { listRunsByOwner, cancelRun, commitRunCompletion } from "../worker";

export type ReconciliationConfig = {
  routineRepo: RoutineRepositoryConfig;
  runRepo: RunRepositoryConfig;
  schedulerClient: SchedulerClient;
  scheduleTarget: {
    queueArn: string;
    roleArn: string;
    dlqArn: string;
  };
};

export type ReconciliationResult = {
  routinesChecked: number;
  schedulesCreated: number;
  schedulesDeleted: number;
  schedulesUpdated: number;
  runsRecovered: number;
  runsCanceled: number;
  errors: Array<{ type: string; id: string; error: string }>;
};

export async function reconcileOwner(
  config: ReconciliationConfig,
  ownerId: string
): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    routinesChecked: 0,
    schedulesCreated: 0,
    schedulesDeleted: 0,
    schedulesUpdated: 0,
    runsRecovered: 0,
    runsCanceled: 0,
    errors: [],
  };

  const routines = await listRoutinesByOwner(config.routineRepo, ownerId, "all");
  result.routinesChecked = routines.length;

  for (const routine of routines) {
    try {
      await reconcileRoutine(config, routine, result);
    } catch (error) {
      result.errors.push({
        type: "routine",
        id: routine.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const runs = await listRunsByOwner(config.runRepo, ownerId, "running", 100);
  for (const run of runs) {
    try {
      await reconcileRun(config, run, result);
    } catch (error) {
      result.errors.push({
        type: "run",
        id: run.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

async function reconcileRoutine(
  config: ReconciliationConfig,
  routine: Routine,
  result: ReconciliationResult
): Promise<void> {
  const schedulerName = generateSchedulerName(routine.ownerId, routine.id);
  const scheduleResult = await config.schedulerClient.getSchedule(schedulerName);

  if (routine.status === "deleted") {
    if (scheduleResult.success) {
      await config.schedulerClient.deleteSchedule(schedulerName);
      result.schedulesDeleted++;
    }
    return;
  }

  if (routine.status === "pending") {
    if (!scheduleResult.success && scheduleResult.code === "NOT_FOUND") {
      const createResult = await config.schedulerClient.createSchedule({
        name: schedulerName,
        scheduleExpression: cronToAwsScheduleExpression(routine.cronExpr),
        timezone: routine.timezone,
        input: {
          ownerId: routine.ownerId,
          routineId: routine.id,
          routineVersion: routine.version,
        },
        target: config.scheduleTarget,
      });

      if (createResult.success) {
        await activateRoutine(
          config.routineRepo,
          routine.ownerId,
          routine.id,
          schedulerName,
          createResult.arn
        );
        result.schedulesCreated++;
      }
    }
    return;
  }

  if (routine.status === "active" || routine.status === "paused") {
    if (!scheduleResult.success && scheduleResult.code === "NOT_FOUND") {
      const createResult = await config.schedulerClient.createSchedule({
        name: schedulerName,
        scheduleExpression: cronToAwsScheduleExpression(routine.cronExpr),
        timezone: routine.timezone,
        input: {
          ownerId: routine.ownerId,
          routineId: routine.id,
          routineVersion: routine.version,
        },
        target: config.scheduleTarget,
      });

      if (createResult.success) {
        result.schedulesCreated++;
      }
      return;
    }

    if (scheduleResult.success) {
      const schedule = scheduleResult.schedule;
      const expectedExpression = cronToAwsScheduleExpression(routine.cronExpr);
      const needsUpdate =
        schedule.scheduleExpression !== expectedExpression ||
        schedule.timezone !== routine.timezone ||
        schedule.input.routineVersion !== routine.version ||
        (routine.status === "active" && schedule.state !== "ENABLED") ||
        (routine.status === "paused" && schedule.state !== "DISABLED");

      if (needsUpdate) {
        await config.schedulerClient.updateSchedule({
          name: schedulerName,
          scheduleExpression: expectedExpression,
          timezone: routine.timezone,
          input: {
            ownerId: routine.ownerId,
            routineId: routine.id,
            routineVersion: routine.version,
          },
          enabled: routine.status === "active",
        });
        result.schedulesUpdated++;
      }
    }
  }
}

async function reconcileRun(
  config: ReconciliationConfig,
  run: AgentRun,
  result: ReconciliationResult
): Promise<void> {
  if (run.status !== "running") return;

  const now = Date.now();

  if (run.leaseExpiresAt && run.leaseExpiresAt < now) {
    const timeSinceExpiry = now - run.leaseExpiresAt;

    if (timeSinceExpiry > 5 * 60 * 1000) {
      if (run.attempt >= run.maxAttempts) {
        const canceled = await cancelRun(
          config.runRepo,
          run.ownerId,
          run.id,
          "Lease expired and max attempts reached"
        );
        if (canceled) {
          result.runsCanceled++;
        }
      } else {
        result.runsRecovered++;
      }
    }
  }

  if (run.routineId) {
    const routine = await import("../routine/repository").then(m =>
      m.getRoutine(config.routineRepo, run.ownerId, run.routineId!)
    );

    if (!routine || routine.status === "deleted") {
      const canceled = await cancelRun(
        config.runRepo,
        run.ownerId,
        run.id,
        "Routine deleted"
      );
      if (canceled) {
        result.runsCanceled++;
      }
      return;
    }

    if (run.routineVersion && routine.version !== run.routineVersion) {
      const canceled = await cancelRun(
        config.runRepo,
        run.ownerId,
        run.id,
        "Routine version changed"
      );
      if (canceled) {
        result.runsCanceled++;
      }
    }
  }
}

export async function redriveDeadLetterMessage(
  config: ReconciliationConfig,
  ownerId: string,
  routineId: string,
  routineVersion: number,
  scheduledAt: string
): Promise<{ success: boolean; reason: string }> {
  const routine = await import("../routine/repository").then(m =>
    m.getRoutine(config.routineRepo, ownerId, routineId)
  );

  if (!routine) {
    return { success: false, reason: "routine_not_found" };
  }

  if (routine.status === "deleted") {
    return { success: false, reason: "routine_deleted" };
  }

  if (routine.version !== routineVersion) {
    return { success: false, reason: "stale_version" };
  }

  return { success: true, reason: "ready_for_redrive" };
}
