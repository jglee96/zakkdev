import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import {
  createRoutine,
  listRoutinesByOwner,
  type RoutineRepositoryConfig,
  RoutineValidationError,
  RoutineLimitError,
} from "@/shared/finance/routine";
import { getRepositoryConfig } from "@/shared/finance/agent";

export const runtime = "nodejs";
export const maxDuration = 15;

type CreateRoutineBody = {
  botId?: string;
  name?: string;
  instruction?: string;
  cronExpr?: string;
  timezone?: string;
};

function getRoutineRepoConfig(): RoutineRepositoryConfig {
  const config = getRepositoryConfig();
  return {
    tableName: config.tableName,
    client: config.client,
  };
}

export async function GET(request: Request) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";

    const repoConfig = getRoutineRepoConfig();
    const routines = await listRoutinesByOwner(
      repoConfig,
      auth.session.ownerId,
      status === "all" ? "all" : (status as "pending" | "active" | "paused" | "deleted")
    );

    return jsonResponse({
      routines: routines.map((r) => ({
        id: r.id,
        botId: r.botId,
        name: r.name,
        instruction: r.instruction,
        cronExpr: r.cronExpr,
        timezone: r.timezone,
        status: r.status,
        version: r.version,
        schedulerName: r.schedulerName,
        lastScheduledAt: r.lastScheduledAt,
        nextScheduledAt: r.nextScheduledAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
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
    const repoConfig = getRoutineRepoConfig();
    const routine = await createRoutine(repoConfig, auth.session.ownerId, {
      botId: body.botId,
      name: body.name,
      instruction: body.instruction,
      cronExpr: body.cronExpr,
      timezone: body.timezone,
    });

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
        createdAt: routine.createdAt,
      },
    }, 201);
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
