import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import { MAIN_BOT_ID } from "@/shared/finance/constants";
import {
  getBot,
  getRecentMessages,
  getRepositoryConfig,
  listBots,
} from "@/shared/finance/agent";

export const runtime = "nodejs";
export const maxDuration = 15;

type Params = {
  params: Promise<{ botId: string }>;
};

async function resolveBotForOwner(
  ownerId: string,
  botId: string,
) {
  const repoConfig = getRepositoryConfig();
  let bot = await getBot(repoConfig, ownerId, botId);
  if (!bot && botId === MAIN_BOT_ID) {
    const bots = await listBots(repoConfig, ownerId, "active");
    bot = bots.find((b) => b.template === "main") ?? null;
  }
  return { repoConfig, bot };
}

export async function GET(request: Request, { params }: Params) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { botId } = await params;

  try {
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));

    const { repoConfig, bot } = await resolveBotForOwner(auth.session.ownerId, botId);

    if (!bot) {
      return jsonResponse({ messages: [] });
    }

    const stored = await getRecentMessages(repoConfig, bot.id, limit);
    const messages = stored.map((msg) => ({
      id: msg.id,
      botId,
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls,
      toolCallId: msg.toolCallId,
      sources: msg.sources,
      blocks: msg.blocks,
      datePrecision: msg.datePrecision,
      structuredFallback: msg.structuredFallback,
      createdAt: msg.createdAt,
    }));

    return jsonResponse({ messages });
  } catch (error) {
    console.error("[GET /api/finance/bots/:botId/messages] failed:", error);
    return jsonResponse({ error: "메시지 조회에 실패했습니다." }, 500);
  }
}
