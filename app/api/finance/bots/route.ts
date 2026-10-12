import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import {
  createBot,
  listBots,
  getRepositoryConfig,
  isValidTemplate,
  type BotTemplate,
} from "@/shared/finance/agent";

export const runtime = "nodejs";
export const maxDuration = 15;

type CreateBotBody = {
  template?: string;
  name?: string;
  instructions?: string;
  allowedTools?: string[];
};

export async function GET(request: Request) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "active";

    const repoConfig = getRepositoryConfig();
    const bots = await listBots(
      repoConfig,
      auth.session.ownerId,
      status === "all" ? "all" : (status as "active" | "paused" | "archived")
    );

    return jsonResponse({
      bots: bots.map((bot) => ({
        id: bot.id,
        name: bot.name,
        template: bot.template,
        status: bot.status,
        allowedTools: bot.allowedTools,
        instructions: bot.instructions,
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt,
      })),
      count: bots.length,
    });
  } catch (error) {
    console.error("[GET /api/finance/bots] failed:", error);
    return jsonResponse({ error: "봇 목록 조회에 실패했습니다." }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  let body: CreateBotBody;
  try {
    body = (await request.json()) as CreateBotBody;
  } catch {
    return jsonResponse({ error: "요청 본문(JSON)을 읽을 수 없습니다." }, 400);
  }

  if (!body.template || !body.name) {
    return jsonResponse({ error: "template과 name은 필수입니다." }, 400);
  }

  if (!isValidTemplate(body.template)) {
    return jsonResponse(
      { error: `잘못된 템플릿입니다: ${body.template}. main, kr-stock, us-stock, index-futures 중 하나를 선택하세요.` },
      400
    );
  }

  try {
    const repoConfig = getRepositoryConfig();
    const bot = await createBot(repoConfig, auth.session.ownerId, {
      template: body.template as BotTemplate,
      name: body.name,
      instructions: body.instructions,
      allowedTools: body.allowedTools,
    });

    return jsonResponse({
      bot: {
        id: bot.id,
        name: bot.name,
        template: bot.template,
        status: bot.status,
        allowedTools: bot.allowedTools,
        instructions: bot.instructions,
        createdAt: bot.createdAt,
      },
    }, 201);
  } catch (error) {
    console.error("[POST /api/finance/bots] failed:", error);
    const message = error instanceof Error ? error.message : "봇 생성에 실패했습니다.";
    return jsonResponse({ error: message }, 500);
  }
}
