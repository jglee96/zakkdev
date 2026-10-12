import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import { getRun, type RunRepositoryConfig } from "@/shared/finance/worker";
import { getRepositoryConfig } from "@/shared/finance/agent";

export const runtime = "nodejs";
export const maxDuration = 15;

type Params = {
  params: Promise<{ runId: string }>;
};

function getRunRepoConfig(): RunRepositoryConfig {
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

  const { runId } = await params;

  try {
    const repoConfig = getRunRepoConfig();
    const run = await getRun(repoConfig, auth.session.ownerId, runId);

    if (!run) {
      return jsonResponse({ error: "실행 기록을 찾을 수 없습니다." }, 404);
    }

    return jsonResponse({
      run: {
        id: run.id,
        botId: run.botId,
        routineId: run.routineId,
        routineVersion: run.routineVersion,
        scheduledAt: run.scheduledAt,
        status: run.status,
        attempt: run.attempt,
        maxAttempts: run.maxAttempts,
        usage: run.usage,
        error: run.error,
        errorCode: run.errorCode,
        reportData: run.reportData,
        checkpoint: run.checkpoint,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      },
    });
  } catch (error) {
    console.error("[GET /api/finance/runs/:runId] failed:", error);
    return jsonResponse({ error: "실행 기록 조회에 실패했습니다." }, 500);
  }
}
