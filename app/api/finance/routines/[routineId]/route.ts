import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import {
  getRoutine,
  updateRoutine,
  updateRoutineWithScheduler,
  deleteRoutine,
  deleteRoutineWithScheduler,
  RoutineNotFoundError,
  RoutineValidationError,
  RoutineVersionConflictError,
  SchedulerConfigurationError,
  assertFinanceSchedulerProductionConfig,
  getRoutineOrchestratorConfig,
  isSchedulerOrchestrationEnabled,
  orchestratorErrorStatus,
  orchestratorFailureMessage,
} from "@/shared/finance/routine";
import { getFinanceTableRepoConfig } from "@/shared/finance/api/table-repo-config";
import { toFinanceRoutine } from "@/shared/finance/shell/serializers";
import type { UpdateRoutineInput } from "@/shared/finance/routine";

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

export async function GET(request: Request, { params }: Params) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { routineId } = await params;

  try {
    const repoConfig = getFinanceTableRepoConfig();
    const routine = await getRoutine(repoConfig, auth.session.ownerId, routineId);

    if (!routine) {
      return jsonResponse({ error: "루틴을 찾을 수 없습니다." }, 404);
    }

    return jsonResponse({ routine: toFinanceRoutine(routine) });
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

  const updates: UpdateRoutineInput = {};
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.instruction === "string") updates.instruction = body.instruction;
  if (typeof body.cronExpr === "string") updates.cronExpr = body.cronExpr;
  if (typeof body.timezone === "string") updates.timezone = body.timezone;
  if (typeof body.status === "string" && ["active", "paused"].includes(body.status)) {
    updates.status = body.status as "active" | "paused";
  }

  if (Object.keys(updates).length === 0) {
    return jsonResponse({ error: "수정할 항목이 없습니다." }, 400);
  }

  try {
    assertFinanceSchedulerProductionConfig();
    if (!isSchedulerOrchestrationEnabled()) {
      const repoConfig = getFinanceTableRepoConfig();
      const routine = await updateRoutine(repoConfig, auth.session.ownerId, routineId, updates);
      return jsonResponse({ routine: toFinanceRoutine(routine) });
    }

    const result = await updateRoutineWithScheduler(
      getRoutineOrchestratorConfig(),
      auth.session.ownerId,
      routineId,
      updates,
    );

    if (!result.success) {
      return jsonResponse(
        orchestratorFailureMessage(result),
        orchestratorErrorStatus(result.code),
      );
    }

    return jsonResponse({ routine: toFinanceRoutine(result.data) });
  } catch (error) {
    console.error("[PATCH /api/finance/routines/:routineId] failed:", error);
    if (error instanceof SchedulerConfigurationError) {
      return jsonResponse({ error: error.message, code: "SCHEDULER_CONFIG" }, 503);
    }
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
    assertFinanceSchedulerProductionConfig();
    if (!isSchedulerOrchestrationEnabled()) {
      const repoConfig = getFinanceTableRepoConfig();
      const existing = await getRoutine(repoConfig, auth.session.ownerId, routineId);
      if (!existing) {
        return jsonResponse({ error: "루틴을 찾을 수 없습니다." }, 404);
      }
      await deleteRoutine(repoConfig, auth.session.ownerId, routineId);
      return jsonResponse({ success: true });
    }

    const result = await deleteRoutineWithScheduler(
      getRoutineOrchestratorConfig(),
      auth.session.ownerId,
      routineId,
    );

    if (!result.success) {
      return jsonResponse(
        orchestratorFailureMessage(result),
        orchestratorErrorStatus(result.code),
      );
    }

    return jsonResponse({ success: true, routine: toFinanceRoutine(result.data) });
  } catch (error) {
    console.error("[DELETE /api/finance/routines/:routineId] failed:", error);
    if (error instanceof SchedulerConfigurationError) {
      return jsonResponse({ error: error.message, code: "SCHEDULER_CONFIG" }, 503);
    }
    if (error instanceof RoutineNotFoundError) {
      return jsonResponse({ error: "루틴을 찾을 수 없습니다." }, 404);
    }
    if (error instanceof RoutineVersionConflictError) {
      return jsonResponse({ error: "루틴이 동시에 수정되었습니다. 다시 시도해주세요." }, 409);
    }
    return jsonResponse({ error: "루틴 삭제에 실패했습니다." }, 500);
  }
}
