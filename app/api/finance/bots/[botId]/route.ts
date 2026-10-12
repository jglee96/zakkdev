import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import {
  getBot,
  updateBot,
  getRepositoryConfig,
  getBotConversationHistory,
} from "@/shared/finance/agent";

export const runtime = "nodejs";
export const maxDuration = 15;

type UpdateBotBody = {
  name?: string;
  instructions?: string;
  status?: string;
  allowedTools?: string[];
};

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
    const repoConfig = getRepositoryConfig();
    const bot = await getBot(repoConfig, auth.session.ownerId, botId);

    if (!bot) {
      return jsonResponse({ error: "봇을 찾을 수 없습니다." }, 404);
    }

    const url = new URL(request.url);
    const includeHistory = url.searchParams.get("history") === "true";

    let history;
    if (includeHistory) {
      const limit = Math.min(50, Number(url.searchParams.get("historyLimit")) || 20);
      history = await getBotConversationHistory(repoConfig, botId, limit);
    }

    return jsonResponse({
      bot: {
        id: bot.id,
        name: bot.name,
        template: bot.template,
        status: bot.status,
        instructions: bot.instructions,
        allowedTools: bot.allowedTools,
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt,
      },
      history,
    });
  } catch (error) {
    console.error("[GET /api/finance/bots/:botId] failed:", error);
    return jsonResponse({ error: "봇 조회에 실패했습니다." }, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { botId } = await params;

  let body: UpdateBotBody;
  try {
    body = (await request.json()) as UpdateBotBody;
  } catch {
    return jsonResponse({ error: "요청 본문(JSON)을 읽을 수 없습니다." }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.instructions === "string") updates.instructions = body.instructions;
  if (typeof body.status === "string" && ["active", "paused", "archived"].includes(body.status)) {
    updates.status = body.status;
  }
  if (Array.isArray(body.allowedTools)) updates.allowedTools = body.allowedTools;

  if (Object.keys(updates).length === 0) {
    return jsonResponse({ error: "수정할 항목이 없습니다." }, 400);
  }

  try {
    const repoConfig = getRepositoryConfig();
    const bot = await updateBot(repoConfig, auth.session.ownerId, botId, updates);

    return jsonResponse({
      bot: {
        id: bot.id,
        name: bot.name,
        template: bot.template,
        status: bot.status,
        instructions: bot.instructions,
        allowedTools: bot.allowedTools,
        updatedAt: bot.updatedAt,
      },
    });
  } catch (error) {
    console.error("[PATCH /api/finance/bots/:botId] failed:", error);
    const message = error instanceof Error ? error.message : "봇 수정에 실패했습니다.";
    const status = message.includes("not found") ? 404 : 500;
    return jsonResponse({ error: message }, status);
  }
}
