import "server-only";
import { randomUUID } from "node:crypto";
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  type Routine,
  type CreateRoutineInput,
  type UpdateRoutineInput,
  type RoutineStatus,
  validateCronExpression,
  isValidTimezone,
  MAX_ROUTINES_PER_OWNER,
  MAX_ROUTINES_PER_BOT,
} from "./types";

export type RoutineRepositoryConfig = {
  tableName: string;
  client: DynamoDBDocumentClient;
};

export class RoutineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutineValidationError";
  }
}

export class RoutineLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutineLimitError";
  }
}

export class RoutineNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutineNotFoundError";
  }
}

export class RoutineVersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutineVersionConflictError";
  }
}

export async function createRoutine(
  config: RoutineRepositoryConfig,
  ownerId: string,
  input: CreateRoutineInput
): Promise<Routine> {
  const cronResult = validateCronExpression(input.cronExpr);
  if (!cronResult.valid) {
    throw new RoutineValidationError(`Invalid cron expression: ${cronResult.error}`);
  }

  if (!isValidTimezone(input.timezone)) {
    throw new RoutineValidationError(`Invalid timezone: ${input.timezone}`);
  }

  if (!input.name || input.name.length > 100) {
    throw new RoutineValidationError("Name must be 1-100 characters");
  }

  if (!input.instruction || input.instruction.length > 2000) {
    throw new RoutineValidationError("Instruction must be 1-2000 characters");
  }

  const ownerRoutines = await listRoutinesByOwner(config, ownerId, "all");
  const activeOwnerRoutines = ownerRoutines.filter((r) => r.status !== "deleted");
  if (activeOwnerRoutines.length >= MAX_ROUTINES_PER_OWNER) {
    throw new RoutineLimitError(`Maximum ${MAX_ROUTINES_PER_OWNER} routines per owner`);
  }

  const botRoutines = activeOwnerRoutines.filter((r) => r.botId === input.botId);
  if (botRoutines.length >= MAX_ROUTINES_PER_BOT) {
    throw new RoutineLimitError(`Maximum ${MAX_ROUTINES_PER_BOT} routines per bot`);
  }

  const id = randomUUID();
  const now = Date.now();
  const routine: Routine = {
    id,
    ownerId,
    botId: input.botId,
    name: input.name,
    instruction: input.instruction,
    cronExpr: cronResult.normalized,
    timezone: input.timezone,
    status: "pending",
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const pk = `routine#${ownerId}#${id}`;
  const sk = "meta";

  await config.client.send(
    new PutCommand({
      TableName: config.tableName,
      Item: {
        pk,
        sk,
        ...routine,
        statusCreatedAt: `${routine.status}#${now}`,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    })
  );

  return routine;
}

export async function getRoutine(
  config: RoutineRepositoryConfig,
  ownerId: string,
  routineId: string
): Promise<Routine | null> {
  const pk = `routine#${ownerId}#${routineId}`;

  const result = await config.client.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { pk, sk: "meta" },
      ConsistentRead: true,
    })
  );

  if (!result.Item) return null;
  if (result.Item.ownerId !== ownerId) return null;

  return itemToRoutine(result.Item);
}

export async function listRoutinesByOwner(
  config: RoutineRepositoryConfig,
  ownerId: string,
  statusFilter: RoutineStatus | "all" = "all"
): Promise<Routine[]> {
  const filterParts: string[] = ["begins_with(pk, :pkPrefix)"];
  const expressionAttributeValues: Record<string, unknown> = {
    ":ownerId": ownerId,
    ":pkPrefix": "routine#",
  };

  if (statusFilter !== "all") {
    filterParts.push("begins_with(statusCreatedAt, :status)");
    expressionAttributeValues[":status"] = statusFilter;
  }

  const result = await config.client.send(
    new QueryCommand({
      TableName: config.tableName,
      IndexName: "ByOwnerStatus",
      KeyConditionExpression: "ownerId = :ownerId",
      FilterExpression: filterParts.join(" AND "),
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );

  return (result.Items || []).map(itemToRoutine);
}

export async function listRoutinesByBot(
  config: RoutineRepositoryConfig,
  ownerId: string,
  botId: string,
  statusFilter: RoutineStatus | "all" = "all"
): Promise<Routine[]> {
  const routines = await listRoutinesByOwner(config, ownerId, statusFilter);
  return routines.filter((r) => r.botId === botId);
}

export async function updateRoutine(
  config: RoutineRepositoryConfig,
  ownerId: string,
  routineId: string,
  input: UpdateRoutineInput,
  expectedVersion?: number
): Promise<Routine> {
  const existing = await getRoutine(config, ownerId, routineId);
  if (!existing) {
    throw new RoutineNotFoundError(`Routine not found: ${routineId}`);
  }

  if (existing.status === "deleted") {
    throw new RoutineValidationError("Cannot update deleted routine");
  }

  if (expectedVersion !== undefined && existing.version !== expectedVersion) {
    throw new RoutineVersionConflictError(
      `Version mismatch: expected ${expectedVersion}, got ${existing.version}`
    );
  }

  if (input.cronExpr) {
    const cronResult = validateCronExpression(input.cronExpr);
    if (!cronResult.valid) {
      throw new RoutineValidationError(`Invalid cron expression: ${cronResult.error}`);
    }
    input.cronExpr = cronResult.normalized;
  }

  if (input.timezone && !isValidTimezone(input.timezone)) {
    throw new RoutineValidationError(`Invalid timezone: ${input.timezone}`);
  }

  if (input.name !== undefined && (input.name.length < 1 || input.name.length > 100)) {
    throw new RoutineValidationError("Name must be 1-100 characters");
  }

  if (input.instruction !== undefined && (input.instruction.length < 1 || input.instruction.length > 2000)) {
    throw new RoutineValidationError("Instruction must be 1-2000 characters");
  }

  const now = Date.now();
  const newVersion = existing.version + 1;
  const newStatus = input.status || existing.status;
  const pk = `routine#${ownerId}#${routineId}`;

  const updateExprParts: string[] = [
    "#version = :newVersion",
    "#updatedAt = :now",
    "#statusCreatedAt = :statusCreatedAt",
  ];
  const exprAttrNames: Record<string, string> = {
    "#version": "version",
    "#updatedAt": "updatedAt",
    "#statusCreatedAt": "statusCreatedAt",
  };
  const exprAttrValues: Record<string, unknown> = {
    ":newVersion": newVersion,
    ":now": now,
    ":statusCreatedAt": `${newStatus}#${existing.createdAt}`,
    ":expectedVersion": existing.version,
  };

  if (input.name !== undefined) {
    updateExprParts.push("#name = :name");
    exprAttrNames["#name"] = "name";
    exprAttrValues[":name"] = input.name;
  }
  if (input.instruction !== undefined) {
    updateExprParts.push("#instruction = :instruction");
    exprAttrNames["#instruction"] = "instruction";
    exprAttrValues[":instruction"] = input.instruction;
  }
  if (input.cronExpr !== undefined) {
    updateExprParts.push("#cronExpr = :cronExpr");
    exprAttrNames["#cronExpr"] = "cronExpr";
    exprAttrValues[":cronExpr"] = input.cronExpr;
  }
  if (input.timezone !== undefined) {
    updateExprParts.push("#timezone = :timezone");
    exprAttrNames["#timezone"] = "timezone";
    exprAttrValues[":timezone"] = input.timezone;
  }
  if (input.status !== undefined) {
    updateExprParts.push("#status = :status");
    exprAttrNames["#status"] = "status";
    exprAttrValues[":status"] = input.status;
  }

  try {
    await config.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: config.tableName,
              Key: { pk, sk: "meta" },
              UpdateExpression: `SET ${updateExprParts.join(", ")}`,
              ConditionExpression: "#version = :expectedVersion",
              ExpressionAttributeNames: exprAttrNames,
              ExpressionAttributeValues: exprAttrValues,
            },
          },
        ],
      })
    );
  } catch (error) {
    if (error instanceof TransactionCanceledException) {
      throw new RoutineVersionConflictError("Routine was modified concurrently");
    }
    throw error;
  }

  return {
    ...existing,
    name: input.name ?? existing.name,
    instruction: input.instruction ?? existing.instruction,
    cronExpr: input.cronExpr ?? existing.cronExpr,
    timezone: input.timezone ?? existing.timezone,
    status: newStatus,
    version: newVersion,
    updatedAt: now,
  };
}

export async function deleteRoutine(
  config: RoutineRepositoryConfig,
  ownerId: string,
  routineId: string,
  expectedVersion?: number
): Promise<Routine> {
  const existing = await getRoutine(config, ownerId, routineId);
  if (!existing) {
    throw new RoutineNotFoundError(`Routine not found: ${routineId}`);
  }

  if (existing.status === "deleted") {
    return existing;
  }

  if (expectedVersion !== undefined && existing.version !== expectedVersion) {
    throw new RoutineVersionConflictError(
      `Version mismatch: expected ${expectedVersion}, got ${existing.version}`
    );
  }

  const now = Date.now();
  const newVersion = existing.version + 1;
  const pk = `routine#${ownerId}#${routineId}`;
  const deletedExpiresAt = Math.floor((now + 30 * 24 * 60 * 60 * 1000) / 1000);

  try {
    await config.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: config.tableName,
              Key: { pk, sk: "meta" },
              UpdateExpression:
                "SET #status = :deleted, #version = :newVersion, #updatedAt = :now, #deletedAt = :now, #deletedExpiresAt = :ttl, #statusCreatedAt = :statusCreatedAt",
              ConditionExpression: "#version = :expectedVersion",
              ExpressionAttributeNames: {
                "#status": "status",
                "#version": "version",
                "#updatedAt": "updatedAt",
                "#deletedAt": "deletedAt",
                "#deletedExpiresAt": "deletedExpiresAt",
                "#statusCreatedAt": "statusCreatedAt",
              },
              ExpressionAttributeValues: {
                ":deleted": "deleted",
                ":newVersion": newVersion,
                ":now": now,
                ":ttl": deletedExpiresAt,
                ":expectedVersion": existing.version,
                ":statusCreatedAt": `deleted#${existing.createdAt}`,
              },
            },
          },
        ],
      })
    );
  } catch (error) {
    if (error instanceof TransactionCanceledException) {
      throw new RoutineVersionConflictError("Routine was modified concurrently");
    }
    throw error;
  }

  return {
    ...existing,
    status: "deleted",
    version: newVersion,
    updatedAt: now,
    deletedAt: now,
  };
}

export async function activateRoutine(
  config: RoutineRepositoryConfig,
  ownerId: string,
  routineId: string,
  schedulerName: string,
  schedulerArn: string
): Promise<Routine> {
  const existing = await getRoutine(config, ownerId, routineId);
  if (!existing) {
    throw new RoutineNotFoundError(`Routine not found: ${routineId}`);
  }

  if (existing.status !== "pending") {
    throw new RoutineValidationError(`Cannot activate routine in status: ${existing.status}`);
  }

  const now = Date.now();
  const newVersion = existing.version + 1;
  const pk = `routine#${ownerId}#${routineId}`;

  try {
    await config.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: config.tableName,
              Key: { pk, sk: "meta" },
              UpdateExpression:
                "SET #status = :active, #version = :newVersion, #updatedAt = :now, #schedulerName = :schedulerName, #schedulerArn = :schedulerArn, #statusCreatedAt = :statusCreatedAt",
              ConditionExpression: "#version = :expectedVersion AND #status = :pending",
              ExpressionAttributeNames: {
                "#status": "status",
                "#version": "version",
                "#updatedAt": "updatedAt",
                "#schedulerName": "schedulerName",
                "#schedulerArn": "schedulerArn",
                "#statusCreatedAt": "statusCreatedAt",
              },
              ExpressionAttributeValues: {
                ":active": "active",
                ":pending": "pending",
                ":newVersion": newVersion,
                ":now": now,
                ":schedulerName": schedulerName,
                ":schedulerArn": schedulerArn,
                ":expectedVersion": existing.version,
                ":statusCreatedAt": `active#${existing.createdAt}`,
              },
            },
          },
        ],
      })
    );
  } catch (error) {
    if (error instanceof TransactionCanceledException) {
      throw new RoutineVersionConflictError("Routine was modified concurrently");
    }
    throw error;
  }

  return {
    ...existing,
    status: "active",
    version: newVersion,
    schedulerName,
    schedulerArn,
    updatedAt: now,
  };
}

function itemToRoutine(item: Record<string, unknown>): Routine {
  return {
    id: item.id as string,
    ownerId: item.ownerId as string,
    botId: item.botId as string,
    name: item.name as string,
    instruction: item.instruction as string,
    cronExpr: item.cronExpr as string,
    timezone: item.timezone as string,
    status: item.status as RoutineStatus,
    version: item.version as number,
    schedulerName: item.schedulerName as string | undefined,
    schedulerArn: item.schedulerArn as string | undefined,
    lastScheduledAt: item.lastScheduledAt as string | undefined,
    nextScheduledAt: item.nextScheduledAt as string | undefined,
    createdAt: item.createdAt as number,
    updatedAt: item.updatedAt as number,
    deletedAt: item.deletedAt as number | undefined,
  };
}
