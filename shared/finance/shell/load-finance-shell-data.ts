import "server-only";
import {
  getRecentMessages,
  getRepositoryConfig,
  listBots,
} from "../agent/repositories";
import { MAIN_BOT_ID } from "../constants";
import { listRoutinesByOwner } from "../routine";
import { listRunsByOwner } from "../worker";
import type { FinanceShellSnapshot } from "./types";

function mapBots(
  bots: Awaited<ReturnType<typeof listBots>>,
): FinanceShellSnapshot["bots"] {
  return bots.map((bot) => ({
    id: bot.id,
    name: bot.name,
    template: bot.template,
    status: bot.status,
    allowedTools: [...bot.allowedTools],
    instructions: bot.instructions,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
  }));
}

function mapRoutines(
  routines: Awaited<ReturnType<typeof listRoutinesByOwner>>,
): FinanceShellSnapshot["routines"] {
  return routines.map((r) => ({
    id: r.id,
    botId: r.botId,
    name: r.name,
    instruction: r.instruction,
    cronExpr: r.cronExpr,
    timezone: r.timezone,
    status: r.status,
    version: r.version,
    schedulerName: r.schedulerName,
    lastScheduledAt: r.lastScheduledAt,
    nextScheduledAt: r.nextScheduledAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

function mapRuns(
  runs: Awaited<ReturnType<typeof listRunsByOwner>>,
): FinanceShellSnapshot["runs"] {
  return runs.map((run) => ({
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
    reportData: run.reportData
      ? {
          response: run.reportData.response,
          reportId: run.reportData.reportId,
          blocks: run.reportData.blocks,
          sources: run.reportData.sources,
          datePrecision: run.reportData.datePrecision,
          structuredFallback: run.reportData.structuredFallback,
          legacySources: run.reportData.legacySources,
        }
      : undefined,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.createdAt,
  }));
}

function mapMessagesForUiBot(
  stored: Awaited<ReturnType<typeof getRecentMessages>>,
  uiBotId: string,
): FinanceShellSnapshot["activeBotMessages"] {
  return stored.map((msg) => ({
    id: msg.id,
    botId: uiBotId,
    role: msg.role,
    content: msg.content,
    toolCalls: msg.toolCalls ? [...msg.toolCalls] : undefined,
    toolCallId: msg.toolCallId,
    sources: msg.sources ? [...msg.sources] : undefined,
    blocks: msg.blocks ? [...msg.blocks] : undefined,
    datePrecision: msg.datePrecision,
    structuredFallback: msg.structuredFallback,
    createdAt: msg.createdAt,
  }));
}

export async function loadFinanceShellData(
  ownerId: string,
  activeBotId = MAIN_BOT_ID,
): Promise<FinanceShellSnapshot> {
  const repoConfig = getRepositoryConfig();
  const tableRepo = {
    tableName: repoConfig.tableName,
    client: repoConfig.client,
  };

  const botsPromise = listBots(repoConfig, ownerId, "active");

  const [bots, routines, runs, activeBotMessages] = await Promise.all([
    botsPromise,
    listRoutinesByOwner(tableRepo, ownerId, "all"),
    listRunsByOwner(tableRepo, ownerId, undefined, 50),
    botsPromise.then(async (listedBots) => {
      if (activeBotId === MAIN_BOT_ID) {
        const main = listedBots.find((b) => b.template === "main");
        if (!main) {
          return [];
        }
        const stored = await getRecentMessages(repoConfig, main.id, 50);
        return mapMessagesForUiBot(stored, MAIN_BOT_ID);
      }
      const match = listedBots.find((b) => b.id === activeBotId);
      if (!match) {
        return [];
      }
      const stored = await getRecentMessages(repoConfig, match.id, 50);
      return mapMessagesForUiBot(stored, activeBotId);
    }),
  ]);

  return {
    activeBotId,
    bots: mapBots(bots),
    routines: mapRoutines(routines),
    runs: mapRuns(runs),
    activeBotMessages,
  };
}
