import "server-only";
import type { Bot } from "../agent/types";
import type { Message } from "../agent/types";
import type { Routine } from "../routine/types";
import type { AgentRun } from "../worker/types";
import type {
  FinanceShellBot,
  FinanceShellMessage,
  FinanceShellRoutine,
  FinanceShellRun,
} from "./types";

export function toFinanceBot(bot: Bot): FinanceShellBot {
  return {
    id: bot.id,
    name: bot.name,
    template: bot.template,
    status: bot.status,
    allowedTools: [...bot.allowedTools],
    instructions: bot.instructions,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
  };
}

export function toFinanceRoutine(routine: Routine): FinanceShellRoutine {
  return {
    id: routine.id,
    botId: routine.botId,
    name: routine.name,
    instruction: routine.instruction,
    cronExpr: routine.cronExpr,
    timezone: routine.timezone,
    status: routine.status,
    version: routine.version,
    schedulerName: routine.schedulerName,
    lastScheduledAt: routine.lastScheduledAt,
    nextScheduledAt: routine.nextScheduledAt,
    createdAt: routine.createdAt,
    updatedAt: routine.updatedAt,
  };
}

export function toFinanceRunReportData(
  reportData: NonNullable<AgentRun["reportData"]>,
): NonNullable<FinanceShellRun["reportData"]> {
  return {
    response: reportData.response,
    reportId: reportData.reportId,
    blocks: reportData.blocks,
    sources: reportData.sources,
    datePrecision: reportData.datePrecision,
    structuredFallback: reportData.structuredFallback,
    legacySources: reportData.legacySources,
  };
}

export function toFinanceRun(run: AgentRun): FinanceShellRun {
  return {
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
    reportData: run.reportData ? toFinanceRunReportData(run.reportData) : undefined,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.createdAt,
  };
}

export function toFinanceMessage(msg: Message, uiBotId: string): FinanceShellMessage {
  return {
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
  };
}
