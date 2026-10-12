import "server-only";

export type BotTemplate = "main" | "kr-stock" | "us-stock" | "index-futures";

export type BotStatus = "active" | "paused" | "archived";

export type Bot = {
  readonly id: string;
  readonly ownerId: string;
  readonly parentBotId?: string;
  readonly template: BotTemplate;
  readonly name: string;
  readonly instructions: string;
  readonly allowedTools: readonly string[];
  readonly status: BotStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type CreateBotInput = {
  template: BotTemplate;
  name: string;
  instructions?: string;
  allowedTools?: string[];
};

export type UpdateBotInput = {
  name?: string;
  instructions?: string;
  allowedTools?: string[];
  status?: BotStatus;
};

export type MessageRole = "system" | "user" | "assistant" | "tool";

export type Message = {
  readonly id: string;
  readonly ownerId: string;
  readonly botId: string;
  readonly role: MessageRole;
  readonly content: string | null;
  readonly toolCalls?: ReadonlyArray<{
    id: string;
    name: string;
    arguments: string;
  }>;
  readonly toolCallId?: string;
  readonly createdAt: number;
};

export type CreateMessageInput = {
  botId: string;
  role: MessageRole;
  content: string | null;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  toolCallId?: string;
};

export type AgentRunContext = {
  readonly runId: string;
  readonly ownerId: string;
  readonly botId: string;
  readonly parentRunId?: string;
  readonly depth: number;
  readonly startedAt: number;
  readonly deadlineAt: number;
};

export type AgentRunResult = {
  readonly runId: string;
  readonly botId: string;
  readonly status: "completed" | "timeout" | "error" | "budget_exceeded";
  readonly response?: string;
  readonly error?: string;
  readonly usage: {
    steps: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  readonly durationMs: number;
};

export const MAX_RECURSION_DEPTH = 3;
export const SYNC_DEADLINE_MS = 50000;
export const SYNC_CALL_TIMEOUT_MS = 20000;
export const WORKER_DEADLINE_MS = 120000;
export const WORKER_CALL_TIMEOUT_MS = 40000;
