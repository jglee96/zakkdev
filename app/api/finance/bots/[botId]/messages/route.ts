import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import { getRecentMessages, getRepositoryConfig, resolveBotForOwner } from "@/shared/finance/agent";
import { toFinanceMessage } from "@/shared/finance/shell/serializers";

export const runtime = "nodejs";
export const maxDuration = 15;

type Params = {
  params: Promise<{ botId: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { botId } = await params;

  try {
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));

    const repoConfig = getRepositoryConfig();
    const bot = await resolveBotForOwner(repoConfig, auth.session.ownerId, botId);

    if (!bot) {
      return jsonResponse({ messages: [] });
    }

    const stored = await getRecentMessages(repoConfig, bot.id, limit);
    const messages = stored.map((msg) => toFinanceMessage(msg, botId));

    return jsonResponse({ messages });
  } catch (error) {
    console.error("[GET /api/finance/bots/:botId/messages] failed:", error);
    return jsonResponse({ error: "메시지 조회에 실패했습니다." }, 500);
  }
}
