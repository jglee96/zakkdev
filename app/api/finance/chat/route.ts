import { requireFinanceSession } from "@/shared/finance/auth/guard";
import { jsonResponse } from "@/shared/finance/auth/http";
import {
  getRepositoryConfig,
  runAgent,
  createLLMConfig,
  createLLMClient,
  callLLM,
  LLMProviderError,
  TEMPLATE_DEFINITIONS,
  createBot,
  resolveBotForOwner,
  type AgentRuntimeConfig,
} from "@/shared/finance/agent";
import { getCostConfig, createBudgetClient } from "@/shared/finance/cost";
import { MAIN_BOT_ID } from "@/shared/finance/constants";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatBody = {
  botId?: string;
  message?: string;
};

export async function POST(request: Request) {
  const auth = await requireFinanceSession(request);
  if ("response" in auth) {
    return auth.response;
  }

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return jsonResponse({ error: "요청 본문(JSON)을 읽을 수 없습니다." }, 400);
  }

  const message = body.message?.trim();
  if (!message) {
    return jsonResponse({ error: "메시지(message)를 입력해주세요." }, 400);
  }

  const botId = body.botId || MAIN_BOT_ID;

  try {
    const repoConfig = getRepositoryConfig();
    const costConfig = getCostConfig();
    const budgetClient = createBudgetClient();

    let runtimeConfig: AgentRuntimeConfig;
    try {
      const llmConfig = createLLMConfig();
      const llmClient = createLLMClient(llmConfig);
      runtimeConfig = {
        llmConfig,
        llmClient,
        repoConfig,
        costConfig,
        budgetClient,
        callLLMFn: callLLM,
      };
    } catch (error) {
      if (error instanceof LLMProviderError && error.code === "config_error") {
        return jsonResponse({ error: "LLM 서비스가 설정되지 않았습니다." }, 503);
      }
      throw error;
    }

    let bot = await resolveBotForOwner(repoConfig, auth.session.ownerId, botId);

    if (!bot && botId === MAIN_BOT_ID) {
      bot = await createBot(repoConfig, auth.session.ownerId, {
        template: "main",
        name: "Main Financial Bot",
        instructions: TEMPLATE_DEFINITIONS.main.defaultInstructions,
      });
    }

    if (!bot) {
      return jsonResponse({ error: "봇을 찾을 수 없습니다." }, 404);
    }

    if (bot.status !== "active") {
      return jsonResponse({ error: `봇이 활성 상태가 아닙니다: ${bot.status}` }, 400);
    }

    const result = await runAgent(bot, message, runtimeConfig);

    return jsonResponse({
      runId: result.runId,
      botId: result.botId,
      status: result.status,
      response: result.response,
      bodyMarkdown: result.bodyMarkdown,
      blocks: result.blocks,
      sources: result.sources,
      datePrecision: result.datePrecision,
      structuredFallback: result.structuredFallback,
      error: result.error,
      usage: result.usage,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error("[/api/finance/chat] failed:", error);
    return jsonResponse({ error: "채팅 처리 중 오류가 발생했습니다." }, 500);
  }
}
