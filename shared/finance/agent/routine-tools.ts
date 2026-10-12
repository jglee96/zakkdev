import "server-only";
import type { AgentRunContext } from "./types";
import type { AgentRuntimeConfig, ToolExecutor } from "./runtime";
import {
  createRoutine,
  listRoutinesByOwner,
  listRoutinesByBot,
  getRoutine,
  updateRoutine,
  deleteRoutine,
  type RoutineRepositoryConfig,
  RoutineValidationError,
  RoutineLimitError,
  RoutineNotFoundError,
  RoutineVersionConflictError,
} from "../routine";

function getRoutineRepoConfig(runtime: AgentRuntimeConfig): RoutineRepositoryConfig {
  return {
    tableName: runtime.repoConfig.tableName,
    client: runtime.repoConfig.client,
  };
}

export async function executeCreateRoutine(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const botId = args.botId as string | undefined;
  const name = args.name as string | undefined;
  const instruction = args.instruction as string | undefined;
  const cronExpr = args.cronExpr as string | undefined;
  const timezone = (args.timezone as string) || "Asia/Seoul";

  if (!botId || !name || !instruction || !cronExpr) {
    return { error: "botId, name, instruction, cronExpr는 필수입니다." };
  }

  try {
    const repoConfig = getRoutineRepoConfig(runtime);
    const routine = await createRoutine(repoConfig, context.ownerId, {
      botId,
      name,
      instruction,
      cronExpr,
      timezone,
    });

    return {
      routine: {
        id: routine.id,
        botId: routine.botId,
        name: routine.name,
        instruction: routine.instruction,
        cronExpr: routine.cronExpr,
        timezone: routine.timezone,
        status: routine.status,
        version: routine.version,
      },
      message: `루틴 "${routine.name}"이(가) 생성되었습니다. (ID: ${routine.id})`,
    };
  } catch (error) {
    if (error instanceof RoutineValidationError) {
      return { error: error.message, code: "validation_error" };
    }
    if (error instanceof RoutineLimitError) {
      return { error: error.message, code: "limit_exceeded" };
    }
    return { error: error instanceof Error ? error.message : "루틴 생성에 실패했습니다." };
  }
}

export async function executeListRoutines(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const status = (args.status as "pending" | "active" | "paused" | "deleted" | "all") || "all";
  const botId = args.botId as string | undefined;

  try {
    const repoConfig = getRoutineRepoConfig(runtime);

    let routines;
    if (botId) {
      routines = await listRoutinesByBot(repoConfig, context.ownerId, botId, status);
    } else {
      routines = await listRoutinesByOwner(repoConfig, context.ownerId, status);
    }

    const activeRoutines = status === "all"
      ? routines.filter((r) => r.status !== "deleted")
      : routines;

    return {
      routines: activeRoutines.map((r) => ({
        id: r.id,
        botId: r.botId,
        name: r.name,
        instruction: r.instruction.length > 100 ? r.instruction.slice(0, 100) + "..." : r.instruction,
        cronExpr: r.cronExpr,
        timezone: r.timezone,
        status: r.status,
        version: r.version,
        lastScheduledAt: r.lastScheduledAt,
        nextScheduledAt: r.nextScheduledAt,
      })),
      count: activeRoutines.length,
      message: activeRoutines.length > 0
        ? `${activeRoutines.length}개의 루틴을 찾았습니다.`
        : "등록된 루틴이 없습니다.",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "루틴 목록 조회에 실패했습니다." };
  }
}

export async function executePauseRoutine(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const routineId = args.routineId as string | undefined;

  if (!routineId) {
    return { error: "routineId는 필수입니다." };
  }

  try {
    const repoConfig = getRoutineRepoConfig(runtime);
    const routine = await getRoutine(repoConfig, context.ownerId, routineId);

    if (!routine) {
      return { error: "루틴을 찾을 수 없습니다.", routineId };
    }

    if (routine.status === "paused") {
      return {
        routine: { id: routine.id, name: routine.name, status: routine.status },
        message: `루틴 "${routine.name}"은(는) 이미 일시정지 상태입니다.`,
      };
    }

    if (routine.status === "deleted") {
      return { error: "삭제된 루틴은 일시정지할 수 없습니다." };
    }

    const updated = await updateRoutine(repoConfig, context.ownerId, routineId, {
      status: "paused",
    });

    return {
      routine: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        version: updated.version,
      },
      message: `루틴 "${updated.name}"이(가) 일시정지되었습니다.`,
    };
  } catch (error) {
    if (error instanceof RoutineNotFoundError) {
      return { error: "루틴을 찾을 수 없습니다.", code: "not_found" };
    }
    if (error instanceof RoutineVersionConflictError) {
      return { error: "루틴이 동시에 수정되었습니다. 다시 시도해주세요.", code: "conflict" };
    }
    return { error: error instanceof Error ? error.message : "루틴 일시정지에 실패했습니다." };
  }
}

export async function executeResumeRoutine(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const routineId = args.routineId as string | undefined;

  if (!routineId) {
    return { error: "routineId는 필수입니다." };
  }

  try {
    const repoConfig = getRoutineRepoConfig(runtime);
    const routine = await getRoutine(repoConfig, context.ownerId, routineId);

    if (!routine) {
      return { error: "루틴을 찾을 수 없습니다.", routineId };
    }

    if (routine.status === "active") {
      return {
        routine: { id: routine.id, name: routine.name, status: routine.status },
        message: `루틴 "${routine.name}"은(는) 이미 활성 상태입니다.`,
      };
    }

    if (routine.status === "deleted") {
      return { error: "삭제된 루틴은 재개할 수 없습니다." };
    }

    const updated = await updateRoutine(repoConfig, context.ownerId, routineId, {
      status: "active",
    });

    return {
      routine: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        version: updated.version,
      },
      message: `루틴 "${updated.name}"이(가) 재개되었습니다.`,
    };
  } catch (error) {
    if (error instanceof RoutineNotFoundError) {
      return { error: "루틴을 찾을 수 없습니다.", code: "not_found" };
    }
    if (error instanceof RoutineVersionConflictError) {
      return { error: "루틴이 동시에 수정되었습니다. 다시 시도해주세요.", code: "conflict" };
    }
    return { error: error instanceof Error ? error.message : "루틴 재개에 실패했습니다." };
  }
}

export async function executeDeleteRoutine(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const routineId = args.routineId as string | undefined;

  if (!routineId) {
    return { error: "routineId는 필수입니다." };
  }

  try {
    const repoConfig = getRoutineRepoConfig(runtime);
    const routine = await getRoutine(repoConfig, context.ownerId, routineId);

    if (!routine) {
      return { error: "루틴을 찾을 수 없습니다.", routineId };
    }

    if (routine.status === "deleted") {
      return {
        routine: { id: routine.id, name: routine.name, status: routine.status },
        message: `루틴 "${routine.name}"은(는) 이미 삭제되었습니다.`,
      };
    }

    const deleted = await deleteRoutine(repoConfig, context.ownerId, routineId);

    return {
      routine: {
        id: deleted.id,
        name: deleted.name,
        status: deleted.status,
      },
      message: `루틴 "${deleted.name}"이(가) 삭제되었습니다. 더 이상 실행되지 않습니다.`,
    };
  } catch (error) {
    if (error instanceof RoutineNotFoundError) {
      return { error: "루틴을 찾을 수 없습니다.", code: "not_found" };
    }
    if (error instanceof RoutineVersionConflictError) {
      return { error: "루틴이 동시에 수정되었습니다. 다시 시도해주세요.", code: "conflict" };
    }
    return { error: error instanceof Error ? error.message : "루틴 삭제에 실패했습니다." };
  }
}

export function createRoutineToolExecutor(): ToolExecutor {
  return async (name, args, context, runtime) => {
    switch (name) {
      case "create_routine":
        return executeCreateRoutine(args, context, runtime);
      case "list_routines":
        return executeListRoutines(args, context, runtime);
      case "pause_routine":
        return executePauseRoutine(args, context, runtime);
      case "resume_routine":
        return executeResumeRoutine(args, context, runtime);
      case "delete_routine":
        return executeDeleteRoutine(args, context, runtime);
      default:
        return { error: `Unknown routine tool: ${name}` };
    }
  };
}
