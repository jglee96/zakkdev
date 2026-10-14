import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import {
  createRoutine,
  listRoutinesByOwner,
  RoutineValidationError,
  RoutineLimitError,
} from "@/shared/finance/routine";
import { getFinanceTableRepoConfig } from "@/shared/finance/api/table-repo-config";
import { toFinanceRoutine } from "@/shared/finance/shell/serializers";

export const runtime = "nodejs";
export const maxDuration = 15;

type CreateRoutineBody = {
  botId?: string;
  name?: string;
  instruction?: string;
  cronExpr?: string;
  timezone?: string;
};

export async function GET(request: Request) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";

    const repoConfig = getFinanceTableRepoConfig();
    const routines = await listRoutinesByOwner(
      repoConfig,
      auth.session.ownerId,
      status === "all" ? "all" : (status as "pending" | "active" | "paused" | "deleted")
    );

    return jsonResponse({
      routines: routines.map(toFinanceRoutine),
      count: routines.length,
    });
  } catch (error) {
    console.error("[GET /api/finance/routines] failed:", error);
    return jsonResponse({ error: "루틴 목록 조회에 실패했습니다." }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  let body: CreateRoutineBody;
  try {
    body = (await request.json()) as CreateRoutineBody;
  } catch {
    return jsonResponse({ error: "요청 본문(JSON)을 읽을 수 없습니다." }, 400);
  }

  if (!body.botId || !body.name || !body.instruction || !body.cronExpr || !body.timezone) {
    return jsonResponse({ error: "botId, name, instruction, cronExpr, timezone는 필수입니다." }, 400);
  }

  try {
    const repoConfig = getFinanceTableRepoConfig();
    const routine = await createRoutine(repoConfig, auth.session.ownerId, {
      botId: body.botId,
      name: body.name,
      instruction: body.instruction,
      cronExpr: body.cronExpr,
      timezone: body.timezone,
    });

    return jsonResponse({ routine: toFinanceRoutine(routine) }, 201);
  } catch (error) {
    console.error("[POST /api/finance/routines] failed:", error);
    if (error instanceof RoutineValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (error instanceof RoutineLimitError) {
      return jsonResponse({ error: error.message }, 429);
    }
    return jsonResponse({ error: "루틴 생성에 실패했습니다." }, 500);
  }
}
