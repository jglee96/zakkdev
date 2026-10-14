import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import { getRun } from "@/shared/finance/worker";
import { getFinanceTableRepoConfig } from "@/shared/finance/api/table-repo-config";
import { toFinanceRun } from "@/shared/finance/shell/serializers";

export const runtime = "nodejs";
export const maxDuration = 15;

type Params = {
  params: Promise<{ runId: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { runId } = await params;

  try {
    const repoConfig = getFinanceTableRepoConfig();
    const run = await getRun(repoConfig, auth.session.ownerId, runId);

    if (!run) {
      return jsonResponse({ error: "실행 기록을 찾을 수 없습니다." }, 404);
    }

    return jsonResponse({
      run: {
        ...toFinanceRun(run),
        checkpoint: run.checkpoint,
        updatedAt: run.updatedAt,
      },
    });
  } catch (error) {
    console.error("[GET /api/finance/runs/:runId] failed:", error);
    return jsonResponse({ error: "실행 기록 조회에 실패했습니다." }, 500);
  }
}
