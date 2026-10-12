import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import {
  listRunsByOwner,
  type RunRepositoryConfig,
} from "@/shared/finance/worker";
import { getRepositoryConfig } from "@/shared/finance/agent";

export const runtime = "nodejs";
export const maxDuration = 15;

function getRunRepoConfig(): RunRepositoryConfig {
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
    const status = url.searchParams.get("status");
    const limit = Math.min(100, Number(url.searchParams.get("limit")) || 50);

    const repoConfig = getRunRepoConfig();
    const runs = await listRunsByOwner(
      repoConfig,
      auth.session.ownerId,
      status as "queued" | "running" | "completed" | "failed" | "canceled" | "timeout" | undefined,
      limit
    );

    return jsonResponse({
      runs: runs.map((run) => ({
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
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      })),
      count: runs.length,
    });
  } catch (error) {
    console.error("[GET /api/finance/runs] failed:", error);
    return jsonResponse({ error: "실행 목록 조회에 실패했습니다." }, 500);
  }
}
