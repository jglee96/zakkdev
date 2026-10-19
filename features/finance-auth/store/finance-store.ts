"use client";

import { create } from "zustand";
import type { ChatBlock, ChatSource } from "@/shared/finance/chat/types";
import { mergeBotMessages } from "../lib/merge-bot-messages";
import { MAIN_BOT_ID } from "../constants";
import type { FinanceShellSnapshot } from "@/shared/finance/shell/types";

export type BotStatus = "active" | "paused" | "archived";
export type BotTemplate = "main" | "kr-stock" | "us-stock" | "index-futures";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "canceled" | "timeout";
export type RoutineStatus = "pending" | "active" | "paused" | "deleted";
export type BotWorkspaceTab = "chat" | "runs" | "routines" | "sources";

export type Bot = {
  id: string;
  name: string;
  template: BotTemplate;
  status: BotStatus;
  allowedTools: string[];
  instructions?: string;
  createdAt: number;
  updatedAt: number;
};

export type Message = {
  id: string;
  botId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  toolCallId?: string;
  sources?: ChatSource[];
  blocks?: ChatBlock[];
  datePrecision?: string;
  structuredFallback?: boolean;
  createdAt: number;
};

export type ChatResponse = {
  runId: string;
  botId: string;
  status: "completed" | "timeout" | "error" | "budget_exceeded";
  response?: string;
  bodyMarkdown?: string;
  blocks?: ChatBlock[];
  sources?: ChatSource[];
  datePrecision?: string;
  structuredFallback?: boolean;
  error?: string;
  usage: {
    steps: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  durationMs: number;
};

export type Routine = {
  id: string;
  botId: string;
  name: string;
  instruction: string;
  cronExpr: string;
  timezone: string;
  status: RoutineStatus;
  version: number;
  schedulerName?: string;
  schedulerArn?: string;
  lastScheduledAt?: string;
  nextScheduledAt?: string;
  createdAt: number;
  updatedAt: number;
};

export type AgentRun = {
  id: string;
  botId: string;
  routineId?: string;
  routineVersion?: number;
  scheduledAt?: string;
  status: RunStatus;
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
    blocks?: ChatBlock[];
    sources?: ChatSource[];
    datePrecision?: string;
    structuredFallback?: boolean;
    legacySources?: Array<{ type: string; reference: string; title?: string }>;
  };
  startedAt?: number;
  finishedAt?: number;
  createdAt: number;
};

interface FinanceState {
  botWorkspaceTab: BotWorkspaceTab;
  selectedBotId: string;
  bots: Bot[];
  messages: Message[];
  messagesLoadedBotIds: Record<string, boolean>;
  messagesLoadingBotId: string | null;
  messagesError: string | null;
  routines: Routine[];
  runs: AgentRun[];
  isLoadingBots: boolean;
  isLoadingMessages: boolean;
  isLoadingRoutines: boolean;
  isLoadingRuns: boolean;
  isSendingMessage: boolean;
  chatError: string | null;
  botsError: string | null;
  routinesError: string | null;
  runsError: string | null;
  lastChatResponse: ChatResponse | null;

  setBotWorkspaceTab: (tab: BotWorkspaceTab) => void;
  selectBot: (botId: string) => void;
  setSelectedBotId: (botId: string | null) => void;
  setBots: (bots: Bot[]) => void;
  setMessages: (messages: Message[]) => void;
  mergeMessagesForBot: (botId: string, messages: Message[]) => void;
  markMessagesLoaded: (botId: string) => void;
  clearMessagesCache: () => void;
  setMessagesError: (error: string | null) => void;
  setMessagesLoadingBotId: (botId: string | null) => void;
  setRoutines: (routines: Routine[]) => void;
  setRuns: (runs: AgentRun[]) => void;
  addMessage: (message: Message) => void;
  setIsLoadingBots: (loading: boolean) => void;
  setIsLoadingMessages: (loading: boolean) => void;
  setIsLoadingRoutines: (loading: boolean) => void;
  setIsLoadingRuns: (loading: boolean) => void;
  setIsSendingMessage: (sending: boolean) => void;
  setChatError: (error: string | null) => void;
  setBotsError: (error: string | null) => void;
  setRoutinesError: (error: string | null) => void;
  setRunsError: (error: string | null) => void;
  setLastChatResponse: (response: ChatResponse | null) => void;
  updateRun: (runId: string, updates: Partial<AgentRun>) => void;
  updateRoutine: (routineId: string, updates: Partial<Routine>) => void;
  hydrateFromServer: (snapshot: FinanceShellSnapshot) => void;
  reset: () => void;
}

const initialState = {
  botWorkspaceTab: "chat" as BotWorkspaceTab,
  selectedBotId: MAIN_BOT_ID,
  bots: [] as Bot[],
  messages: [] as Message[],
  messagesLoadedBotIds: {} as Record<string, boolean>,
  messagesLoadingBotId: null as string | null,
  messagesError: null as string | null,
  routines: [] as Routine[],
  runs: [] as AgentRun[],
  isLoadingBots: false,
  isLoadingMessages: false,
  isLoadingRoutines: false,
  isLoadingRuns: false,
  isSendingMessage: false,
  chatError: null as string | null,
  botsError: null as string | null,
  routinesError: null as string | null,
  runsError: null as string | null,
  lastChatResponse: null as ChatResponse | null,
};

export const useFinanceStore = create<FinanceState>()((set) => ({
  ...initialState,

  setBotWorkspaceTab: (tab) => set({ botWorkspaceTab: tab }),
  selectBot: (botId) =>
    set({
      selectedBotId: botId,
      botWorkspaceTab: "chat",
      chatError: null,
      lastChatResponse: null,
    }),
  setSelectedBotId: (botId) => set({ selectedBotId: botId ?? MAIN_BOT_ID }),
  setBots: (bots) => set({ bots }),
  setMessages: (messages) => set({ messages }),
  mergeMessagesForBot: (botId, incoming) =>
    set((state) => ({
      messages: mergeBotMessages(state.messages, botId, incoming),
    })),
  markMessagesLoaded: (botId) =>
    set((state) => ({
      messagesLoadedBotIds: { ...state.messagesLoadedBotIds, [botId]: true },
    })),
  clearMessagesCache: () =>
    set({ messagesLoadedBotIds: {}, messages: [], messagesError: null }),
  setMessagesError: (error) => set({ messagesError: error }),
  setMessagesLoadingBotId: (botId) => set({ messagesLoadingBotId: botId }),
  setRoutines: (routines) => set({ routines }),
  setRuns: (runs) => set({ runs }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setIsLoadingBots: (loading) => set({ isLoadingBots: loading }),
  setIsLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
  setIsLoadingRoutines: (loading) => set({ isLoadingRoutines: loading }),
  setIsLoadingRuns: (loading) => set({ isLoadingRuns: loading }),
  setIsSendingMessage: (sending) => set({ isSendingMessage: sending }),
  setChatError: (error) => set({ chatError: error }),
  setBotsError: (error) => set({ botsError: error }),
  setRoutinesError: (error) => set({ routinesError: error }),
  setRunsError: (error) => set({ runsError: error }),
  setLastChatResponse: (response) => set({ lastChatResponse: response }),
  updateRun: (runId, updates) =>
    set((state) => ({
      runs: state.runs.map((run) => (run.id === runId ? { ...run, ...updates } : run)),
    })),
  updateRoutine: (routineId, updates) =>
    set((state) => ({
      routines: state.routines.map((routine) =>
        routine.id === routineId ? { ...routine, ...updates } : routine,
      ),
    })),
  hydrateFromServer: (snapshot) =>
    set({
      bots: snapshot.bots.map((bot) => ({
        ...bot,
        allowedTools: [...bot.allowedTools],
      })),
      routines: snapshot.routines.map((routine) => ({ ...routine })),
      runs: snapshot.runs.map((run) => ({
        ...run,
        reportData: run.reportData
          ? {
              ...run.reportData,
              blocks: run.reportData.blocks ? [...run.reportData.blocks] : undefined,
              sources: run.reportData.sources ? [...run.reportData.sources] : undefined,
              legacySources: run.reportData.legacySources
                ? [...run.reportData.legacySources]
                : undefined,
            }
          : undefined,
      })),
      selectedBotId: snapshot.activeBotId,
      messages: mergeBotMessages(
        [],
        snapshot.activeBotId,
        snapshot.activeBotMessages.map((message) => ({
          ...message,
          toolCalls: message.toolCalls ? [...message.toolCalls] : undefined,
          sources: message.sources ? [...message.sources] : undefined,
          blocks: message.blocks ? [...message.blocks] : undefined,
        })),
      ),
      messagesLoadedBotIds: { [snapshot.activeBotId]: true },
      isLoadingBots: false,
      isLoadingRoutines: false,
      isLoadingRuns: false,
      isLoadingMessages: false,
      messagesLoadingBotId: null,
      botsError: null,
      routinesError: null,
      runsError: null,
      messagesError: null,
    }),
  reset: () => set(initialState),
}));

if (
  typeof window !== "undefined" &&
  (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_EXPOSE_STORE_FOR_TESTS === "1")
) {
  (window as unknown as { __FINANCE_STORE__: typeof useFinanceStore }).__FINANCE_STORE__ =
    useFinanceStore;
}
