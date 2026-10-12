import "server-only";
import { randomUUID } from "node:crypto";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Bot, AgentRunContext, AgentRunResult, CreateBotInput, UpdateBotInput, BotTemplate } from "./types";
import { MAX_RECURSION_DEPTH, SYNC_DEADLINE_MS, SYNC_CALL_TIMEOUT_MS } from "./types";
import { callLLM, createLLMClient, createLLMConfig, LLMProviderError, type LLMConfig, type LLMCallOptions, type LLMResponse } from "./llm-provider";
import { getToolsForBot, parseToolArguments, isToolAllowed } from "./tool-registry";
import { getTemplateDefinition, isValidTemplate } from "./templates";
import {
  createBot,
  getBot,
  listBots,
  updateBot,
  createMessage,
  getBotConversationHistory,
  type RepositoryConfig,
} from "./repositories";
import {
  type CostConfig,
  type RunTracker,
  createRunTracker,
  checkAllLimits,
  recordStep,
  recordCall,
  findAllowedModel,
  reserveBudget,
  settleBudget,
  keepReservation,
  createBudgetClient,
  getCostConfig,
} from "../cost";
import type OpenAI from "openai";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export type AgentRuntimeConfig = {
  readonly llmConfig: LLMConfig;
  readonly llmClient: OpenAI;
  readonly repoConfig: RepositoryConfig;
  readonly costConfig: CostConfig;
  readonly budgetClient: DynamoDBDocumentClient;
  readonly callLLMFn: typeof callLLM;
};

export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
) => Promise<unknown>;

export function createAgentRuntimeConfig(env: Partial<NodeJS.ProcessEnv> = process.env): AgentRuntimeConfig {
  const llmConfig = createLLMConfig(env);
  const llmClient = createLLMClient(llmConfig);
  const { getRepositoryConfig } = require("./repositories");
  const repoConfig = getRepositoryConfig(env);
  const costConfig = getCostConfig(env);
  const budgetClient = createBudgetClient(env);

  return {
    llmConfig,
    llmClient,
    repoConfig,
    costConfig,
    budgetClient,
    callLLMFn: callLLM,
  };
}

export async function runAgent(
  bot: Bot,
  userMessage: string,
  runtime: AgentRuntimeConfig,
  parentContext?: AgentRunContext,
  toolExecutor?: ToolExecutor
): Promise<AgentRunResult> {
  const runId = randomUUID();
  const startedAt = Date.now();
  const depth = parentContext ? parentContext.depth + 1 : 0;

  if (depth > MAX_RECURSION_DEPTH) {
    return {
      runId,
      botId: bot.id,
      status: "error",
      error: `Maximum recursion depth (${MAX_RECURSION_DEPTH}) exceeded`,
      usage: { steps: 0, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      durationMs: Date.now() - startedAt,
    };
  }

  const deadlineAt = parentContext?.deadlineAt || startedAt + SYNC_DEADLINE_MS;
  const context: AgentRunContext = {
    runId,
    ownerId: bot.ownerId,
    botId: bot.id,
    parentRunId: parentContext?.runId,
    depth,
    startedAt,
    deadlineAt,
  };

  const model = findAllowedModel(runtime.costConfig, runtime.llmConfig.model);
  if (!model) {
    return {
      runId,
      botId: bot.id,
      status: "error",
      error: `Model ${runtime.llmConfig.model} is not allowed`,
      usage: { steps: 0, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      durationMs: Date.now() - startedAt,
    };
  }

  const reservationResult = parentContext
    ? { success: true as const, reservation: { reservationId: `child-${runId}`, ownerId: bot.ownerId, runId, budgetDate: "", reservedUsd: 0, status: "reserved" as const, createdAt: 0, updatedAt: 0 } }
    : await reserveBudget(runtime.budgetClient, runtime.costConfig, bot.ownerId, runId, runtime.costConfig.runLimits.maxCostUsd);

  if (!reservationResult.success) {
    return {
      runId,
      botId: bot.id,
      status: "budget_exceeded",
      error: reservationResult.reason === "budget_exceeded"
        ? `Daily budget exceeded. Available: $${reservationResult.available.toFixed(4)}, Requested: $${reservationResult.requested.toFixed(4)}`
        : "Budget reservation failed",
      usage: { steps: 0, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      durationMs: Date.now() - startedAt,
    };
  }

  let tracker = createRunTracker(runId, bot.ownerId, runtime.costConfig, undefined, startedAt);
  const reservationId = reservationResult.reservation.reservationId;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    const templateDef = getTemplateDefinition(bot.template);
    const systemPrompt = `${templateDef.defaultInstructions}\n\n${bot.instructions}`;

    const history = await getBotConversationHistory(runtime.repoConfig, bot.id, 20);
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({
        role: h.role as "user" | "assistant" | "tool",
        content: h.content,
        tool_calls: h.tool_calls,
        tool_call_id: h.tool_call_id,
      } as ChatCompletionMessageParam)),
      { role: "user", content: userMessage },
    ];

    await createMessage(runtime.repoConfig, bot.ownerId, {
      botId: bot.id,
      role: "user",
      content: userMessage,
    });

    const tools = getToolsForBot(bot.allowedTools);
    const executor = toolExecutor || createDefaultToolExecutor();

    for (let step = 0; step < runtime.costConfig.runLimits.maxSteps; step++) {
      const now = Date.now();
      if (now >= deadlineAt) {
        await keepReservation(runtime.budgetClient, runtime.costConfig, reservationId, "timeout");
        return {
          runId,
          botId: bot.id,
          status: "timeout",
          error: "Run deadline exceeded",
          usage: { steps: tracker.usage.steps, calls: tracker.usage.calls, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, costUsd: tracker.usage.costUsd },
          durationMs: now - startedAt,
        };
      }

      const estimatedInputTokens = JSON.stringify(messages).length / 4;
      const limitCheck = checkAllLimits(tracker, runtime.llmConfig.model, estimatedInputTokens, model.pricing.maxOutputTokens, now);
      if (!limitCheck.allowed) {
        await settleBudget(runtime.budgetClient, runtime.costConfig, reservationId, tracker.usage.costUsd);
        return {
          runId,
          botId: bot.id,
          status: "budget_exceeded",
          error: `Limit exceeded: ${limitCheck.reason}`,
          usage: { steps: tracker.usage.steps, calls: tracker.usage.calls, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, costUsd: tracker.usage.costUsd },
          durationMs: now - startedAt,
        };
      }

      tracker = recordStep(tracker);

      let response: LLMResponse;
      try {
        const timeoutMs = Math.min(SYNC_CALL_TIMEOUT_MS, deadlineAt - now - 1000);
        if (timeoutMs <= 0) {
          throw new LLMProviderError("Insufficient time for LLM call", "timeout");
        }

        response = await runtime.callLLMFn(runtime.llmClient, { ...runtime.llmConfig, timeoutMs }, {
          messages,
          tools: tools.length > 0 ? tools : undefined,
          maxTokens: model.pricing.maxOutputTokens,
        });
      } catch (error) {
        if (error instanceof LLMProviderError && error.code === "timeout") {
          await keepReservation(runtime.budgetClient, runtime.costConfig, reservationId, "llm_timeout");
          return {
            runId,
            botId: bot.id,
            status: "timeout",
            error: "LLM call timed out",
            usage: { steps: tracker.usage.steps, calls: tracker.usage.calls, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, costUsd: tracker.usage.costUsd },
            durationMs: Date.now() - startedAt,
          };
        }
        throw error;
      }

      tracker = recordCall(tracker, model, response.usage.inputTokens, response.usage.outputTokens);
      totalInputTokens += response.usage.inputTokens;
      totalOutputTokens += response.usage.outputTokens;

      messages.push({
        role: "assistant",
        content: response.content,
        tool_calls: response.toolCalls.length > 0 ? response.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })) : undefined,
      });

      if (response.toolCalls.length === 0) {
        await createMessage(runtime.repoConfig, bot.ownerId, {
          botId: bot.id,
          role: "assistant",
          content: response.content,
        });

        if (!parentContext) {
          await settleBudget(runtime.budgetClient, runtime.costConfig, reservationId, tracker.usage.costUsd);
        }

        return {
          runId,
          botId: bot.id,
          status: "completed",
          response: response.content || "",
          usage: { steps: tracker.usage.steps, calls: tracker.usage.calls, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, costUsd: tracker.usage.costUsd },
          durationMs: Date.now() - startedAt,
        };
      }

      await createMessage(runtime.repoConfig, bot.ownerId, {
        botId: bot.id,
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls,
      });

      for (const toolCall of response.toolCalls) {
        if (!isToolAllowed(toolCall.name, bot.allowedTools)) {
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Tool ${toolCall.name} is not allowed for this bot` }),
          });
          continue;
        }

        const args = parseToolArguments(toolCall.arguments);
        let result: unknown;

        try {
          result = await executor(toolCall.name, args, context, runtime);
        } catch (error) {
          result = { error: error instanceof Error ? error.message : "Tool execution failed" };
        }

        const resultStr = JSON.stringify(result);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: resultStr,
        });

        await createMessage(runtime.repoConfig, bot.ownerId, {
          botId: bot.id,
          role: "tool",
          content: resultStr,
          toolCallId: toolCall.id,
        });
      }
    }

    await settleBudget(runtime.budgetClient, runtime.costConfig, reservationId, tracker.usage.costUsd);
    return {
      runId,
      botId: bot.id,
      status: "budget_exceeded",
      error: "Maximum steps exceeded",
      usage: { steps: tracker.usage.steps, calls: tracker.usage.calls, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, costUsd: tracker.usage.costUsd },
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    await keepReservation(runtime.budgetClient, runtime.costConfig, reservationId, "error");
    return {
      runId,
      botId: bot.id,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      usage: { steps: tracker.usage.steps, calls: tracker.usage.calls, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, costUsd: tracker.usage.costUsd },
      durationMs: Date.now() - startedAt,
    };
  }
}

function createDefaultToolExecutor(): ToolExecutor {
  return async (name, args, context, runtime) => {
    switch (name) {
      case "create_bot":
        return executeCreateBot(args, context, runtime);
      case "list_bots":
        return executeListBots(args, context, runtime);
      case "update_bot":
        return executeUpdateBot(args, context, runtime);
      case "invoke_bot":
        return executeInvokeBot(args, context, runtime);
      case "list_reports":
        return { reports: [], message: "보고서 기능은 P2에서 구현됩니다." };
      case "search_dart_filings":
      case "get_filing_detail":
      case "get_financials":
        return { message: "OpenDART 연동은 P2에서 구현됩니다.", args };
      case "search_sec_filings":
        return { message: "SEC EDGAR 연동은 후속 버전에서 구현됩니다.", args };
      case "find_relevant_theses":
      case "save_insight":
        return { message: "투자 가설 기능은 P2에서 구현됩니다.", args };
      default:
        return { error: `Unknown tool: ${name}` };
    }
  };
}

async function executeCreateBot(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const template = args.template as string;
  const name = args.name as string;
  const instructions = args.instructions as string | undefined;

  if (!template || !name) {
    return { error: "template과 name은 필수입니다." };
  }

  if (!isValidTemplate(template)) {
    return { error: `잘못된 템플릿입니다: ${template}. kr-stock, us-stock, index-futures 중 하나를 선택하세요.` };
  }

  try {
    const input: CreateBotInput = { template: template as BotTemplate, name, instructions };
    const bot = await createBot(runtime.repoConfig, context.ownerId, input);
    return {
      success: true,
      bot: {
        id: bot.id,
        name: bot.name,
        template: bot.template,
        status: bot.status,
        allowedTools: bot.allowedTools,
      },
      message: `'${bot.name}' 봇이 생성되었습니다.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "봇 생성에 실패했습니다." };
  }
}

async function executeListBots(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const status = (args.status as string) || "active";

  try {
    const bots = await listBots(runtime.repoConfig, context.ownerId, status === "all" ? "all" : status as "active" | "paused" | "archived");
    return {
      bots: bots.map((bot) => ({
        id: bot.id,
        name: bot.name,
        template: bot.template,
        status: bot.status,
        createdAt: bot.createdAt,
      })),
      count: bots.length,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "봇 목록 조회에 실패했습니다." };
  }
}

async function executeUpdateBot(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const botId = args.botId as string;
  if (!botId) {
    return { error: "botId는 필수입니다." };
  }

  const input: UpdateBotInput = {};
  if (typeof args.name === "string") input.name = args.name;
  if (typeof args.instructions === "string") input.instructions = args.instructions;
  if (typeof args.status === "string" && ["active", "paused", "archived"].includes(args.status)) {
    input.status = args.status as "active" | "paused" | "archived";
  }

  if (Object.keys(input).length === 0) {
    return { error: "수정할 항목이 없습니다." };
  }

  try {
    const bot = await updateBot(runtime.repoConfig, context.ownerId, botId, input);
    return {
      success: true,
      bot: {
        id: bot.id,
        name: bot.name,
        status: bot.status,
      },
      message: `'${bot.name}' 봇이 수정되었습니다.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "봇 수정에 실패했습니다." };
  }
}

async function executeInvokeBot(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const botId = args.botId as string;
  const message = args.message as string;

  if (!botId || !message) {
    return { error: "botId와 message는 필수입니다." };
  }

  if (context.depth >= MAX_RECURSION_DEPTH) {
    return { error: `최대 재귀 깊이(${MAX_RECURSION_DEPTH})를 초과했습니다.` };
  }

  try {
    const targetBot = await getBot(runtime.repoConfig, context.ownerId, botId);
    if (!targetBot) {
      return { error: "봇을 찾을 수 없습니다." };
    }

    if (targetBot.status !== "active") {
      return { error: `봇이 활성 상태가 아닙니다: ${targetBot.status}` };
    }

    const result = await runAgent(targetBot, message, runtime, context);

    return {
      botId: targetBot.id,
      botName: targetBot.name,
      status: result.status,
      response: result.response,
      error: result.error,
      usage: result.usage,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "봇 호출에 실패했습니다." };
  }
}
