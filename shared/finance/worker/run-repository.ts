import "server-only";
import { randomUUID } from "node:crypto";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  type AgentRun,
  type AgentRunStatus,
  type CreateRunInput,
  type LeaseAcquisitionResult,
  type LeaseRenewalResult,
  type CommitResult,
  type RunCheckpoint,
  generateIdempotencyKey,
  LEASE_DURATION_MS,
  MAX_ATTEMPTS,
} from "./types";

export type RunRepositoryConfig = {
  tableName: string;
  client: DynamoDBDocumentClient;
};

export class RunNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunNotFoundError";
  }
}

export class LeaseLostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeaseLostError";
  }
}

export class FencingViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FencingViolationError";
  }
}

export async function createOrGetRun(
  config: RunRepositoryConfig,
  input: CreateRunInput,
  workerId: string
): Promise<{ run: AgentRun; created: boolean }> {
  const idempotencyKey = input.routineId && input.routineVersion && input.scheduledAt
    ? generateIdempotencyKey(input.routineId, input.routineVersion, input.scheduledAt)
    : `manual#${randomUUID()}`;

  const existingRun = await getRunByIdempotencyKey(config, input.ownerId, idempotencyKey);
  if (existingRun) {
    return { run: existingRun, created: false };
  }

  const id = randomUUID();
  const now = Date.now();
  const expiresAt = Math.floor((now + 30 * 24 * 60 * 60 * 1000) / 1000);

  const run: AgentRun = {
    id,
    ownerId: input.ownerId,
    botId: input.botId,
    routineId: input.routineId,
    routineVersion: input.routineVersion,
    scheduledAt: input.scheduledAt,
    idempotencyKey,
    status: "queued",
    attempt: 0,
    maxAttempts: input.maxAttempts ?? MAX_ATTEMPTS,
    fencingToken: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  const pk = `run#${input.ownerId}#${id}`;
  const sk = "meta";

  try {
    await config.client.send(
      new PutCommand({
        TableName: config.tableName,
        Item: {
          pk,
          sk,
          ...run,
          statusCreatedAt: `${run.status}#${now}`,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      })
    );

    return { run, created: true };
  } catch (error) {
    const retryRun = await getRunByIdempotencyKey(config, input.ownerId, idempotencyKey);
    if (retryRun) {
      return { run: retryRun, created: false };
    }
    throw error;
  }
}

export async function getRun(
  config: RunRepositoryConfig,
  ownerId: string,
  runId: string
): Promise<AgentRun | null> {
  const pk = `run#${ownerId}#${runId}`;

  const result = await config.client.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { pk, sk: "meta" },
      ConsistentRead: true,
    })
  );

  if (!result.Item) return null;

  return itemToRun(result.Item);
}

export async function getRunByIdempotencyKey(
  config: RunRepositoryConfig,
  ownerId: string,
  idempotencyKey: string
): Promise<AgentRun | null> {
  const result = await config.client.send(
    new QueryCommand({
      TableName: config.tableName,
      IndexName: "ByRoutineScheduled",
      KeyConditionExpression: "routineId = :routineId AND scheduledAt = :scheduledAt",
      FilterExpression: "ownerId = :ownerId AND idempotencyKey = :idempotencyKey",
      ExpressionAttributeValues: {
        ":routineId": idempotencyKey.split("#")[0] || "manual",
        ":scheduledAt": idempotencyKey.split("#")[2] || idempotencyKey,
        ":ownerId": ownerId,
        ":idempotencyKey": idempotencyKey,
      },
      Limit: 1,
    })
  );

  if (!result.Items || result.Items.length === 0) return null;

  return itemToRun(result.Items[0]);
}

export async function listRunsByOwner(
  config: RunRepositoryConfig,
  ownerId: string,
  statusFilter?: AgentRunStatus,
  limit = 50
): Promise<AgentRun[]> {
  let filterExpression: string | undefined;
  let expressionAttributeValues: Record<string, unknown> = {
    ":ownerId": ownerId,
  };

  if (statusFilter) {
    filterExpression = "begins_with(statusCreatedAt, :status)";
    expressionAttributeValues[":status"] = statusFilter;
  }

  const result = await config.client.send(
    new QueryCommand({
      TableName: config.tableName,
      IndexName: "ByOwnerStatus",
      KeyConditionExpression: "ownerId = :ownerId",
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: limit,
      ScanIndexForward: false,
    })
  );

  return (result.Items || []).map(itemToRun);
}

export async function acquireLease(
  config: RunRepositoryConfig,
  ownerId: string,
  runId: string,
  workerId: string,
  routineVersion?: number
): Promise<LeaseAcquisitionResult> {
  const run = await getRun(config, ownerId, runId);
  if (!run) {
    return { acquired: false, reason: "not_found" };
  }

  if (routineVersion !== undefined && run.routineVersion !== routineVersion) {
    return { acquired: false, reason: "stale_version" };
  }

  if (run.status === "completed" || run.status === "failed" || run.status === "canceled") {
    return { acquired: false, reason: "completed" };
  }

  const now = Date.now();

  if (run.status === "running" && run.leaseExpiresAt && run.leaseExpiresAt > now) {
    if (run.leaseOwner !== workerId) {
      return { acquired: false, reason: "already_running" };
    }
  }

  const newFencingToken = run.fencingToken + 1;
  const leaseExpiresAt = now + LEASE_DURATION_MS;
  const newAttempt = run.status === "queued" ? run.attempt + 1 : run.attempt;
  const pk = `run#${ownerId}#${runId}`;

  try {
    await config.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: config.tableName,
              Key: { pk, sk: "meta" },
              UpdateExpression:
                "SET #status = :running, #leaseOwner = :workerId, #leaseExpiresAt = :leaseExpiresAt, #fencingToken = :newFencingToken, #attempt = :attempt, #startedAt = if_not_exists(#startedAt, :now), #updatedAt = :now, #statusCreatedAt = :statusCreatedAt",
              ConditionExpression:
                "#fencingToken = :currentFencingToken AND (#status = :queued OR (#status = :running AND #leaseExpiresAt < :now))",
              ExpressionAttributeNames: {
                "#status": "status",
                "#leaseOwner": "leaseOwner",
                "#leaseExpiresAt": "leaseExpiresAt",
                "#fencingToken": "fencingToken",
                "#attempt": "attempt",
                "#startedAt": "startedAt",
                "#updatedAt": "updatedAt",
                "#statusCreatedAt": "statusCreatedAt",
              },
              ExpressionAttributeValues: {
                ":running": "running",
                ":queued": "queued",
                ":workerId": workerId,
                ":leaseExpiresAt": leaseExpiresAt,
                ":newFencingToken": newFencingToken,
                ":currentFencingToken": run.fencingToken,
                ":attempt": newAttempt,
                ":now": now,
                ":statusCreatedAt": `running#${run.createdAt}`,
              },
            },
          },
        ],
      })
    );

    return {
      acquired: true,
      run: {
        ...run,
        status: "running",
        leaseOwner: workerId,
        leaseExpiresAt,
        fencingToken: newFencingToken,
        attempt: newAttempt,
        startedAt: run.startedAt || now,
        updatedAt: now,
      },
      fencingToken: newFencingToken,
    };
  } catch (error) {
    if (error instanceof TransactionCanceledException) {
      return { acquired: false, reason: "already_running" };
    }
    throw error;
  }
}

export async function renewLease(
  config: RunRepositoryConfig,
  ownerId: string,
  runId: string,
  workerId: string,
  fencingToken: number
): Promise<LeaseRenewalResult> {
  const now = Date.now();
  const newLeaseExpiresAt = now + LEASE_DURATION_MS;
  const pk = `run#${ownerId}#${runId}`;

  try {
    await config.client.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: { pk, sk: "meta" },
        UpdateExpression: "SET #leaseExpiresAt = :newExpiresAt, #updatedAt = :now",
        ConditionExpression:
          "#leaseOwner = :workerId AND #fencingToken = :fencingToken AND #status = :running",
        ExpressionAttributeNames: {
          "#leaseExpiresAt": "leaseExpiresAt",
          "#updatedAt": "updatedAt",
          "#leaseOwner": "leaseOwner",
          "#fencingToken": "fencingToken",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":newExpiresAt": newLeaseExpiresAt,
          ":now": now,
          ":workerId": workerId,
          ":fencingToken": fencingToken,
          ":running": "running",
        },
      })
    );

    return { renewed: true, newExpiresAt: newLeaseExpiresAt };
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      const run = await getRun(config, ownerId, runId);
      if (!run) {
        return { renewed: false, reason: "not_found" };
      }
      if (run.fencingToken !== fencingToken) {
        return { renewed: false, reason: "fencing_violation" };
      }
      return { renewed: false, reason: "lease_lost" };
    }
    throw error;
  }
}

export async function commitRunCompletion(
  config: RunRepositoryConfig,
  ownerId: string,
  runId: string,
  workerId: string,
  fencingToken: number,
  status: "completed" | "failed" | "timeout",
  usage?: AgentRun["usage"],
  error?: string,
  errorCode?: string
): Promise<CommitResult> {
  const now = Date.now();
  const pk = `run#${ownerId}#${runId}`;

  const run = await getRun(config, ownerId, runId);
  if (!run) {
    return { committed: false, reason: "not_found" };
  }

  try {
    await config.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: config.tableName,
              Key: { pk, sk: "meta" },
              UpdateExpression:
                "SET #status = :status, #finishedAt = :now, #updatedAt = :now, #usage = :usage, #error = :error, #errorCode = :errorCode, #statusCreatedAt = :statusCreatedAt REMOVE #leaseOwner, #leaseExpiresAt",
              ConditionExpression:
                "#leaseOwner = :workerId AND #fencingToken = :fencingToken AND #status = :running",
              ExpressionAttributeNames: {
                "#status": "status",
                "#finishedAt": "finishedAt",
                "#updatedAt": "updatedAt",
                "#usage": "usage",
                "#error": "error",
                "#errorCode": "errorCode",
                "#statusCreatedAt": "statusCreatedAt",
                "#leaseOwner": "leaseOwner",
                "#leaseExpiresAt": "leaseExpiresAt",
                "#fencingToken": "fencingToken",
              },
              ExpressionAttributeValues: {
                ":status": status,
                ":now": now,
                ":usage": usage || null,
                ":error": error || null,
                ":errorCode": errorCode || null,
                ":statusCreatedAt": `${status}#${run.createdAt}`,
                ":workerId": workerId,
                ":fencingToken": fencingToken,
                ":running": "running",
              },
            },
          },
        ],
      })
    );

    return { committed: true };
  } catch (error) {
    if (error instanceof TransactionCanceledException) {
      const freshRun = await getRun(config, ownerId, runId);
      if (!freshRun) {
        return { committed: false, reason: "not_found" };
      }
      if (freshRun.fencingToken !== fencingToken) {
        return { committed: false, reason: "fencing_violation" };
      }
      return { committed: false, reason: "lease_lost" };
    }
    throw error;
  }
}

export async function requeueRun(
  config: RunRepositoryConfig,
  ownerId: string,
  runId: string,
  workerId: string,
  fencingToken: number,
  checkpoint?: RunCheckpoint,
  error?: string
): Promise<CommitResult> {
  const run = await getRun(config, ownerId, runId);
  if (!run) {
    return { committed: false, reason: "not_found" };
  }

  if (run.attempt >= run.maxAttempts) {
    return commitRunCompletion(
      config,
      ownerId,
      runId,
      workerId,
      fencingToken,
      "failed",
      run.usage,
      error || "Max attempts exceeded",
      "MAX_ATTEMPTS"
    );
  }

  const now = Date.now();
  const pk = `run#${ownerId}#${runId}`;

  try {
    await config.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: config.tableName,
              Key: { pk, sk: "meta" },
              UpdateExpression:
                "SET #status = :queued, #updatedAt = :now, #checkpoint = :checkpoint, #error = :error, #statusCreatedAt = :statusCreatedAt REMOVE #leaseOwner, #leaseExpiresAt",
              ConditionExpression:
                "#leaseOwner = :workerId AND #fencingToken = :fencingToken AND #status = :running",
              ExpressionAttributeNames: {
                "#status": "status",
                "#updatedAt": "updatedAt",
                "#checkpoint": "checkpoint",
                "#error": "error",
                "#statusCreatedAt": "statusCreatedAt",
                "#leaseOwner": "leaseOwner",
                "#leaseExpiresAt": "leaseExpiresAt",
                "#fencingToken": "fencingToken",
              },
              ExpressionAttributeValues: {
                ":queued": "queued",
                ":now": now,
                ":checkpoint": checkpoint || null,
                ":error": error || null,
                ":statusCreatedAt": `queued#${run.createdAt}`,
                ":workerId": workerId,
                ":fencingToken": fencingToken,
                ":running": "running",
              },
            },
          },
        ],
      })
    );

    return { committed: true };
  } catch (error) {
    if (error instanceof TransactionCanceledException) {
      return { committed: false, reason: "lease_lost" };
    }
    throw error;
  }
}

export async function cancelRun(
  config: RunRepositoryConfig,
  ownerId: string,
  runId: string,
  reason: string
): Promise<boolean> {
  const run = await getRun(config, ownerId, runId);
  if (!run) return false;

  if (run.status === "completed" || run.status === "failed" || run.status === "canceled") {
    return false;
  }

  const now = Date.now();
  const pk = `run#${ownerId}#${runId}`;

  try {
    await config.client.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: { pk, sk: "meta" },
        UpdateExpression:
          "SET #status = :canceled, #finishedAt = :now, #updatedAt = :now, #error = :reason, #statusCreatedAt = :statusCreatedAt",
        ConditionExpression: "#status IN (:queued, :running)",
        ExpressionAttributeNames: {
          "#status": "status",
          "#finishedAt": "finishedAt",
          "#updatedAt": "updatedAt",
          "#error": "error",
          "#statusCreatedAt": "statusCreatedAt",
        },
        ExpressionAttributeValues: {
          ":canceled": "canceled",
          ":now": now,
          ":reason": reason,
          ":statusCreatedAt": `canceled#${run.createdAt}`,
          ":queued": "queued",
          ":running": "running",
        },
      })
    );

    return true;
  } catch {
    return false;
  }
}

function itemToRun(item: Record<string, unknown>): AgentRun {
  return {
    id: item.id as string,
    ownerId: item.ownerId as string,
    botId: item.botId as string,
    routineId: item.routineId as string | undefined,
    routineVersion: item.routineVersion as number | undefined,
    scheduledAt: item.scheduledAt as string | undefined,
    idempotencyKey: item.idempotencyKey as string,
    status: item.status as AgentRunStatus,
    attempt: item.attempt as number,
    maxAttempts: item.maxAttempts as number,
    leaseOwner: item.leaseOwner as string | undefined,
    leaseExpiresAt: item.leaseExpiresAt as number | undefined,
    fencingToken: item.fencingToken as number,
    model: item.model as string | undefined,
    usage: item.usage as AgentRun["usage"] | undefined,
    error: item.error as string | undefined,
    errorCode: item.errorCode as string | undefined,
    checkpoint: item.checkpoint as RunCheckpoint | undefined,
    startedAt: item.startedAt as number | undefined,
    finishedAt: item.finishedAt as number | undefined,
    createdAt: item.createdAt as number,
    updatedAt: item.updatedAt as number,
    expiresAt: item.expiresAt as number | undefined,
  };
}
