import "server-only";
import { randomUUID } from "node:crypto";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  TransactionCanceledException,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { CostConfigurationError, type CostConfig } from "./config";

export type BudgetReservation = {
  readonly reservationId: string;
  readonly ownerId: string;
  readonly runId: string;
  readonly budgetDate: string;
  readonly reservedUsd: number;
  readonly status: "reserved" | "settled" | "released";
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type ReserveResult =
  | { success: true; reservation: BudgetReservation }
  | { success: false; reason: "budget_exceeded"; available: number; requested: number }
  | { success: false; reason: "config_error" | "storage_error" };

export type SettleResult =
  | { success: true; actualCost: number; refunded: number }
  | { success: false; reason: "not_found" | "already_settled" | "storage_error" };

export function createBudgetClient(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const region = env.AWS_REGION || env.AWS_DEFAULT_REGION;
  if (!region) throw new CostConfigurationError("AWS_REGION is not configured");

  let endpoint: string | undefined;
  if (env.FINANCE_DYNAMODB_ENDPOINT) {
    const url = new URL(env.FINANCE_DYNAMODB_ENDPOINT);
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (env.NODE_ENV === "production" || !isLocal || url.protocol !== "http:" || url.username || url.password) {
      throw new CostConfigurationError("FINANCE_DYNAMODB_ENDPOINT is not allowed in this environment");
    }
    endpoint = url.origin;
  }

  return DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region,
      endpoint,
      maxAttempts: 3,
      ...(endpoint ? { credentials: { accessKeyId: "local", secretAccessKey: "local" } } : {}),
    }),
    { marshallOptions: { removeUndefinedValues: true } }
  );
}

function getBudgetDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function getExpiresAt(budgetDate: string): number {
  const date = new Date(budgetDate);
  date.setUTCDate(date.getUTCDate() + 7);
  return Math.floor(date.getTime() / 1000);
}

export async function reserveBudget(
  client: DynamoDBDocumentClient,
  config: CostConfig,
  ownerId: string,
  runId: string,
  requestedUsd: number,
  now = new Date()
): Promise<ReserveResult> {
  if (requestedUsd <= 0 || !Number.isFinite(requestedUsd)) {
    return { success: false, reason: "config_error" };
  }

  const budgetDate = getBudgetDate(now);
  const dailyKey = `budget#${ownerId}#${budgetDate}`;
  const reservationId = randomUUID();
  const timestamp = now.getTime();
  const expiresAt = getExpiresAt(budgetDate);

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const attemptReservationId = attempt === 0 ? reservationId : randomUUID();
    try {
      const result = await client.send(
        new GetCommand({
          TableName: config.tableName,
          Key: { pk: dailyKey },
          ProjectionExpression: "spent, reserved, version",
          ConsistentRead: true,
        })
      );

      const currentSpent = (result.Item?.spent as number) || 0;
      const currentReserved = (result.Item?.reserved as number) || 0;
      const currentVersion = (result.Item?.version as number) || 0;
      const available = config.dailyBudgetUsd - currentSpent - currentReserved;

      if (requestedUsd > available) {
        return { success: false, reason: "budget_exceeded", available, requested: requestedUsd };
      }

      await client.send(
        new TransactWriteCommand({
          ClientRequestToken: attemptReservationId,
          TransactItems: [
            {
              Update: {
                TableName: config.tableName,
                Key: { pk: dailyKey },
                UpdateExpression:
                  "SET #spent = if_not_exists(#spent, :zero), #reserved = if_not_exists(#reserved, :zero) + :amount, #expiresAt = :ttl, #version = :newVersion",
                ConditionExpression:
                  "attribute_not_exists(#version) OR #version = :currentVersion",
                ExpressionAttributeNames: {
                  "#spent": "spent",
                  "#reserved": "reserved",
                  "#expiresAt": "expiresAt",
                  "#version": "version",
                },
                ExpressionAttributeValues: {
                  ":zero": 0,
                  ":amount": requestedUsd,
                  ":ttl": expiresAt,
                  ":currentVersion": currentVersion,
                  ":newVersion": currentVersion + 1,
                },
              },
            },
          {
            Put: {
              TableName: config.tableName,
              Item: {
                pk: `reservation#${attemptReservationId}`,
                ownerId,
                runId,
                budgetDate,
                reservedUsd: requestedUsd,
                status: "reserved",
                createdAt: timestamp,
                updatedAt: timestamp,
                expiresAt,
              },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
        ],
      })
    );

    return {
      success: true,
      reservation: {
        reservationId: attemptReservationId,
        ownerId,
        runId,
        budgetDate,
        reservedUsd: requestedUsd,
        status: "reserved",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    };
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        const reasons = error.CancellationReasons || [];
        if (reasons.some((r) => r.Code === "ConditionalCheckFailed")) {
          if (attempt < maxRetries - 1) {
            continue;
          }
          const freshUsage = await getOwnerDailyUsage(client, config, ownerId, now);
          const actualAvailable = freshUsage?.available ?? 0;
          return { success: false, reason: "budget_exceeded", available: actualAvailable, requested: requestedUsd };
        }
      }
      return { success: false, reason: "storage_error" };
    }
  }
  return { success: false, reason: "storage_error" };
}

export async function settleBudget(
  client: DynamoDBDocumentClient,
  config: CostConfig,
  reservationId: string,
  actualCostUsd: number,
  now = new Date()
): Promise<SettleResult> {
  if (actualCostUsd < 0 || !Number.isFinite(actualCostUsd)) {
    return { success: false, reason: "storage_error" };
  }

  const timestamp = now.getTime();

  try {
    const reservationResult = await client.send(
      new GetCommand({
        TableName: config.tableName,
        Key: { pk: `reservation#${reservationId}` },
        ConsistentRead: true,
      })
    );

    if (!reservationResult.Item) {
      return { success: false, reason: "not_found" };
    }

    const item = reservationResult.Item;
    if (item.status !== "reserved") {
      return { success: false, reason: "already_settled" };
    }

    const reservedUsd = item.reservedUsd as number;
    const ownerId = item.ownerId as string;
    const budgetDate = item.budgetDate as string;
    const refund = Math.max(0, reservedUsd - actualCostUsd);
    const dailyKey = `budget#${ownerId}#${budgetDate}`;
    const expiresAt = getExpiresAt(budgetDate);

    const dailyResult = await client.send(
      new GetCommand({
        TableName: config.tableName,
        Key: { pk: dailyKey },
        ProjectionExpression: "version",
        ConsistentRead: true,
      })
    );
    const currentVersion = (dailyResult.Item?.version as number) || 0;

    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: config.tableName,
              Key: { pk: dailyKey },
              UpdateExpression: "SET #spent = if_not_exists(#spent, :zero) + :cost, #reserved = if_not_exists(#reserved, :zero) - :reservedAmt, #expiresAt = :ttl, #version = :newVersion",
              ConditionExpression: "(attribute_not_exists(#reserved) OR #reserved >= :reservedAmt) AND (attribute_not_exists(#version) OR #version = :currentVersion)",
              ExpressionAttributeNames: {
                "#spent": "spent",
                "#reserved": "reserved",
                "#expiresAt": "expiresAt",
                "#version": "version",
              },
              ExpressionAttributeValues: {
                ":zero": 0,
                ":cost": actualCostUsd,
                ":reservedAmt": reservedUsd,
                ":ttl": expiresAt,
                ":currentVersion": currentVersion,
                ":newVersion": currentVersion + 1,
              },
            },
          },
          {
            Update: {
              TableName: config.tableName,
              Key: { pk: `reservation#${reservationId}` },
              UpdateExpression: "SET #status = :settledStatus, #actualCost = :cost, #updatedAt = :ts",
              ConditionExpression: "#status = :reservedStatus",
              ExpressionAttributeNames: {
                "#status": "status",
                "#actualCost": "actualCost",
                "#updatedAt": "updatedAt",
              },
              ExpressionAttributeValues: {
                ":settledStatus": "settled",
                ":reservedStatus": "reserved",
                ":cost": actualCostUsd,
                ":ts": timestamp,
              },
            },
          },
        ],
      })
    );

    return { success: true, actualCost: actualCostUsd, refunded: refund };
  } catch (error) {
    if (error instanceof TransactionCanceledException) {
      const reasons = error.CancellationReasons || [];
      if (reasons.some((r) => r.Code === "ConditionalCheckFailed")) {
        return { success: false, reason: "already_settled" };
      }
    }
    return { success: false, reason: "storage_error" };
  }
}

export async function releaseBudget(
  client: DynamoDBDocumentClient,
  config: CostConfig,
  reservationId: string,
  now = new Date()
): Promise<SettleResult> {
  return settleBudget(client, config, reservationId, 0, now);
}

export async function getOwnerDailyUsage(
  client: DynamoDBDocumentClient,
  config: CostConfig,
  ownerId: string,
  now = new Date()
): Promise<{ spent: number; reserved: number; available: number } | null> {
  const budgetDate = getBudgetDate(now);
  const dailyKey = `budget#${ownerId}#${budgetDate}`;

  try {
    const result = await client.send(
      new GetCommand({
        TableName: config.tableName,
        Key: { pk: dailyKey },
        ProjectionExpression: "spent, reserved",
        ConsistentRead: true,
      })
    );

    const spent = (result.Item?.spent as number) || 0;
    const reserved = (result.Item?.reserved as number) || 0;
    const available = Math.max(0, config.dailyBudgetUsd - spent - reserved);

    return { spent, reserved, available };
  } catch {
    return null;
  }
}

export async function keepReservation(
  client: DynamoDBDocumentClient,
  config: CostConfig,
  reservationId: string,
  reason: string,
  now = new Date()
): Promise<boolean> {
  const timestamp = now.getTime();

  try {
    await client.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: { pk: `reservation#${reservationId}` },
        UpdateExpression: "SET #unclearReason = :reason, #updatedAt = :ts",
        ConditionExpression: "#status = :reserved",
        ExpressionAttributeNames: {
          "#unclearReason": "unclearReason",
          "#updatedAt": "updatedAt",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":reason": reason,
          ":ts": timestamp,
          ":reserved": "reserved",
        },
      })
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return false;
    }
    throw error;
  }
}
