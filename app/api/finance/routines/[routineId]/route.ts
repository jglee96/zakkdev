import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import {
  getRoutine,
  updateRoutine,
  deleteRoutine,
  type RoutineRepositoryConfig,
  RoutineNotFoundError,
  RoutineValidationError,
  RoutineVersionConflictError,
} from "@/shared/finance/routine";
import { getRepositoryConfig } from "@/shared/finance/agent";

export const runtime = "nodejs";
export const maxDuration = 15;

type UpdateRoutineBody = {
  name?: string;
  instruction?: string;
  cronExpr?: string;
  timezone?: string;
  status?: string;
};

type Params = {
  params: Promise<{ routineId: string }>;
};

function getRoutineRepoConfig(): RoutineRepositoryConfig {
  const config = getRepositoryConfig();
  return {
    tableName: config.tableName,
    client: config.client,
  };
}

export async function GET(request: Request, { params }: Params) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { routineId } = await params;

  try {
    const repoConfig = getRoutineRepoConfig();
    const routine = await getRoutine(repoConfig, auth.session.ownerId, routineId);

    if (!routine) {
      return jsonResponse({ error: "루틴을 찾을 수 없습니다." }, 404);
    }

    return jsonResponse({
      routine: {
        id: routine.id,
        botId: routine.botId,
        name: routine.name,
        instruction: routine.instruction,
        cronExpr: routine.cronExpr,
        timezone: routine.timezone,
        status: routine.status,
        version: routine.version,
        schedulerName: routine.schedulerName,
        lastScheduledAt: routine.lastScheduledAt,
        nextScheduledAt: routine.nextScheduledAt,
        createdAt: routine.createdAt,
        updatedAt: routine.updatedAt,
      },
    });
  } catch (error) {
    console.error("[GET /api/finance/routines/:routineId] failed:", error);
    return jsonResponse({ error: "루틴 조회에 실패했습니다." }, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { routineId } = await params;

  let body: UpdateRoutineBody;
  try {
    body = (await request.json()) as UpdateRoutineBody;
  } catch {
    return jsonResponse({ error: "요청 본문(JSON)을 읽을 수 없습니다." }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.instruction === "string") updates.instruction = body.instruction;
  if (typeof body.cronExpr === "string") updates.cronExpr = body.cronExpr;
  if (typeof body.timezone === "string") updates.timezone = body.timezone;
  if (typeof body.status === "string" && ["active", "paused"].includes(body.status)) {
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return jsonResponse({ error: "수정할 항목이 없습니다." }, 400);
  }

  try {
    const repoConfig = getRoutineRepoConfig();
    const routine = await updateRoutine(repoConfig, auth.session.ownerId, routineId, updates);

    return jsonResponse({
      routine: {
        id: routine.id,
        botId: routine.botId,
        name: routine.name,
        instruction: routine.instruction,
        cronExpr: routine.cronExpr,
        timezone: routine.timezone,
        status: routine.status,
        version: routine.version,
        updatedAt: routine.updatedAt,
      },
    });
  } catch (error) {
    console.error("[PATCH /api/finance/routines/:routineId] failed:", error);
    if (error instanceof RoutineNotFoundError) {
      return jsonResponse({ error: "루틴을 찾을 수 없습니다." }, 404);
    }
    if (error instanceof RoutineValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (error instanceof RoutineVersionConflictError) {
      return jsonResponse({ error: "루틴이 동시에 수정되었습니다. 다시 시도해주세요." }, 409);
    }
    return jsonResponse({ error: "루틴 수정에 실패했습니다." }, 500);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { routineId } = await params;

  try {
    const repoConfig = getRoutineRepoConfig();
    await deleteRoutine(repoConfig, auth.session.ownerId, routineId);

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("[DELETE /api/finance/routines/:routineId] failed:", error);
    if (error instanceof RoutineNotFoundError) {
      return jsonResponse({ error: "루틴을 찾을 수 없습니다." }, 404);
    }
    if (error instanceof RoutineVersionConflictError) {
      return jsonResponse({ error: "루틴이 동시에 수정되었습니다. 다시 시도해주세요." }, 409);
    }
    return jsonResponse({ error: "루틴 삭제에 실패했습니다." }, 500);
  }
}
