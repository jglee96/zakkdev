import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import { listRunsByOwner } from "@/shared/finance/worker";
import { getFinanceTableRepoConfig } from "@/shared/finance/api/table-repo-config";
import { toFinanceRun } from "@/shared/finance/shell/serializers";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(request: Request) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const limit = Math.min(100, Number(url.searchParams.get("limit")) || 50);

    const repoConfig = getFinanceTableRepoConfig();
    const runs = await listRunsByOwner(
      repoConfig,
      auth.session.ownerId,
      status as "queued" | "running" | "completed" | "failed" | "canceled" | "timeout" | undefined,
      limit
    );

    return jsonResponse({
      runs: runs.map((run) => ({
        ...toFinanceRun(run),
        updatedAt: run.updatedAt,
      })),
      count: runs.length,
    });
  } catch (error) {
    console.error("[GET /api/finance/runs] failed:", error);
    return jsonResponse({ error: "실행 목록 조회에 실패했습니다." }, 500);
  }
}
