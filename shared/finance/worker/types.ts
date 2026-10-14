import "server-only";
import type { ChatBlock, ChatSource } from "../chat/types";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "canceled"
  | "timeout";

export type AgentRun = {
  readonly id: string;
  readonly ownerId: string;
  readonly botId: string;
  readonly routineId?: string;
  readonly routineVersion?: number;
  readonly scheduledAt?: string;
  readonly idempotencyKey: string;
  readonly status: AgentRunStatus;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly leaseOwner?: string;
  readonly leaseExpiresAt?: number;
  readonly fencingToken: number;
  readonly model?: string;
  readonly usage?: {
    steps: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  readonly error?: string;
  readonly errorCode?: string;
  readonly checkpoint?: RunCheckpoint;
  readonly reportData?: RunReportData;
  readonly startedAt?: number;
  readonly finishedAt?: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt?: number;
};

export type RunCheckpoint = {
  readonly stepIndex: number;
  readonly lastToolCallId?: string;
  readonly pendingToolResults?: Array<{
    toolCallId: string;
    result: string;
  }>;
  readonly messagesSnapshot?: string;
  readonly budgetReservationId?: string;
};

export type RunReportData = {
  readonly response?: string;
  readonly bodyMarkdown?: string;
  readonly reportId?: string;
  readonly memorySnapshot?: string;
  readonly blocks?: readonly ChatBlock[];
  readonly sources?: readonly ChatSource[];
  readonly datePrecision?: string;
  readonly structuredFallback?: boolean;
  readonly legacySources?: ReadonlyArray<{
    type: string;
    reference: string;
    title?: string;
  }>;
};

export type CreateRunInput = {
  ownerId: string;
  botId: string;
  routineId?: string;
  routineVersion?: number;
  scheduledAt?: string;
  instruction: string;
  maxAttempts?: number;
};

export type WorkerMessage = {
  ownerId: string;
  routineId: string;
  routineVersion: number;
  scheduledAt: string;
};

export type LeaseAcquisitionResult =
  | { acquired: true; run: AgentRun; fencingToken: number }
  | { acquired: false; reason: "not_found" | "already_running" | "completed" | "stale_version" | "deleted_routine" };

export type LeaseRenewalResult =
  | { renewed: true; newExpiresAt: number }
  | { renewed: false; reason: "not_found" | "lease_lost" | "fencing_violation" };

export type CommitResult =
  | { committed: true }
  | { committed: false; reason: "not_found" | "lease_lost" | "fencing_violation" | "version_conflict" };

export const LEASE_DURATION_MS = 60000;
export const HEARTBEAT_INTERVAL_MS = 20000;
export const WORKER_DEADLINE_MS = 120000;
export const WORKER_CALL_TIMEOUT_MS = 40000;
export const MAX_ATTEMPTS = 5;

export function generateIdempotencyKey(
  routineId: string,
  routineVersion: number,
  scheduledAt: string
): string {
  return `${routineId}#${routineVersion}#${scheduledAt}`;
}

export function parseIdempotencyKey(key: string): {
  routineId: string;
  routineVersion: number;
  scheduledAt: string;
} | null {
  const parts = key.split("#");
  if (parts.length !== 3) return null;

  const [routineId, versionStr, scheduledAt] = parts;
  const routineVersion = parseInt(versionStr, 10);

  if (isNaN(routineVersion)) return null;

  return { routineId, routineVersion, scheduledAt };
}
