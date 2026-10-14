import type { ChatBlock, ChatSource } from "../chat/types";

export type FinanceShellBot = {
  id: string;
  name: string;
  template: "main" | "kr-stock" | "us-stock" | "index-futures";
  status: "active" | "paused" | "archived";
  allowedTools: readonly string[];
  instructions?: string;
  createdAt: number;
  updatedAt: number;
};

export type FinanceShellMessage = {
  id: string;
  botId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  toolCalls?: ReadonlyArray<{ id: string; name: string; arguments: string }>;
  toolCallId?: string;
  sources?: readonly ChatSource[];
  blocks?: readonly ChatBlock[];
  datePrecision?: string;
  structuredFallback?: boolean;
  createdAt: number;
};

export type FinanceShellRoutine = {
  id: string;
  botId: string;
  name: string;
  instruction: string;
  cronExpr: string;
  timezone: string;
  status: "pending" | "active" | "paused" | "deleted";
  version: number;
  schedulerName?: string;
  schedulerArn?: string;
  lastScheduledAt?: string;
  nextScheduledAt?: string;
  createdAt: number;
  updatedAt: number;
};

export type FinanceShellRun = {
  id: string;
  botId: string;
  routineId?: string;
  routineVersion?: number;
  scheduledAt?: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled" | "timeout";
  attempt: number;
  maxAttempts: number;
  usage?: {
    steps: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  error?: string;
  errorCode?: string;
  reportData?: {
    response?: string;
    reportId?: string;
    blocks?: readonly ChatBlock[];
    sources?: readonly ChatSource[];
    datePrecision?: string;
    structuredFallback?: boolean;
    legacySources?: ReadonlyArray<{ type: string; reference: string; title?: string }>;
  };
  startedAt?: number;
  finishedAt?: number;
  createdAt: number;
};

/** Serializable finance shell payload loaded on the server and hydrated once on the client. */
export type FinanceShellSnapshot = {
  activeBotId: string;
  bots: FinanceShellBot[];
  routines: FinanceShellRoutine[];
  runs: FinanceShellRun[];
  activeBotMessages: FinanceShellMessage[];
};
