"use client";

import { create } from "zustand";

export type BotStatus = "active" | "paused" | "archived";
export type BotTemplate = "main" | "kr-stock" | "us-stock" | "index-futures";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "canceled" | "timeout";
export type RoutineStatus = "pending" | "active" | "paused" | "deleted";

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
  createdAt: number;
};

export type ChatResponse = {
  runId: string;
  botId: string;
  status: "completed" | "timeout" | "error" | "budget_exceeded";
  response?: string;
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
    sources?: Array<{ type: string; reference: string; title?: string }>;
  };
  startedAt?: number;
  finishedAt?: number;
  createdAt: number;
};

type ActiveTab = "chat" | "bots" | "routines" | "runs";

interface FinanceState {
  activeTab: ActiveTab;
  selectedBotId: string | null;
  bots: Bot[];
  messages: Message[];
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
  
  setActiveTab: (tab: ActiveTab) => void;
  setSelectedBotId: (botId: string | null) => void;
  setBots: (bots: Bot[]) => void;
  setMessages: (messages: Message[]) => void;
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
  reset: () => void;
}

const initialState = {
  activeTab: "chat" as ActiveTab,
  selectedBotId: null,
  bots: [],
  messages: [],
  routines: [],
  runs: [],
  isLoadingBots: false,
  isLoadingMessages: false,
  isLoadingRoutines: false,
  isLoadingRuns: false,
  isSendingMessage: false,
  chatError: null,
  botsError: null,
  routinesError: null,
  runsError: null,
  lastChatResponse: null,
};

export const useFinanceStore = create<FinanceState>()((set) => ({
  ...initialState,
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedBotId: (botId) => set({ selectedBotId: botId }),
  setBots: (bots) => set({ bots }),
  setMessages: (messages) => set({ messages }),
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
  updateRun: (runId, updates) => set((state) => ({
    runs: state.runs.map((run) => run.id === runId ? { ...run, ...updates } : run),
  })),
  updateRoutine: (routineId, updates) => set((state) => ({
    routines: state.routines.map((routine) => routine.id === routineId ? { ...routine, ...updates } : routine),
  })),
  reset: () => set(initialState),
}));
