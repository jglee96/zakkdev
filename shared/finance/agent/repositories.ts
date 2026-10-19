import "server-only";
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  applyFinanceAwsClientConfig,
  FinanceAwsConfigError,
  resolveFinanceLocalDynamoEndpoint,
} from "../aws/credentials";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Bot, BotStatus, BotTemplate, CreateBotInput, CreateMessageInput, Message, UpdateBotInput } from "./types";
import { getDefaultTools, getTemplateDefinition, validateAllowedTools } from "./templates";

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "validation" | "storage" | "config"
  ) {
    super(message);
  }
}

export type RepositoryConfig = {
  readonly tableName: string;
  readonly client: DynamoDBDocumentClient;
};

export function createRepositoryClient(env: Partial<NodeJS.ProcessEnv> = process.env): DynamoDBDocumentClient {
  const region = env.AWS_REGION || env.AWS_DEFAULT_REGION;
  if (!region) throw new RepositoryError("AWS_REGION is not configured", "config");

  let endpoint: string | undefined;
  try {
    endpoint = resolveFinanceLocalDynamoEndpoint(env);
  } catch (error) {
    if (error instanceof FinanceAwsConfigError) {
      throw new RepositoryError(error.message, "config");
    }
    throw error;
  }

  return DynamoDBDocumentClient.from(
    new DynamoDBClient(
      applyFinanceAwsClientConfig(
        {
          region,
          endpoint,
          maxAttempts: 3,
        },
        env,
      ),
    ),
    { marshallOptions: { removeUndefinedValues: true } },
  );
}

export function getRepositoryConfig(env: Partial<NodeJS.ProcessEnv> = process.env): RepositoryConfig {
  const tableName = env.FINANCE_DATA_TABLE;
  if (!tableName || !/^[A-Za-z0-9_.-]{3,255}$/.test(tableName)) {
    throw new RepositoryError("FINANCE_DATA_TABLE is not configured", "config");
  }

  return {
    tableName,
    client: createRepositoryClient(env),
  };
}

function getBotPK(ownerId: string) {
  return `OWNER#${ownerId}`;
}

function getBotSK(botId: string) {
  return `BOT#${botId}`;
}

function getMessagePK(botId: string) {
  return `BOT#${botId}#MESSAGES`;
}

function getMessageSK(createdAt: number, messageId: string) {
  return `MSG#${createdAt.toString().padStart(15, "0")}#${messageId}`;
}

export async function createBot(
  config: RepositoryConfig,
  ownerId: string,
  input: CreateBotInput,
  now = Date.now()
): Promise<Bot> {
  const template = input.template as BotTemplate;
  const templateDef = getTemplateDefinition(template);

  const allowedTools = input.allowedTools || getDefaultTools(template);
  const validation = validateAllowedTools(template, allowedTools);
  if (!validation.valid) {
    const errors: string[] = [];
    if (validation.invalidTools.length > 0) {
      errors.push(`Invalid tools: ${validation.invalidTools.join(", ")}`);
    }
    if (validation.missingRequired.length > 0) {
      errors.push(`Missing required tools: ${validation.missingRequired.join(", ")}`);
    }
    throw new RepositoryError(errors.join("; "), "validation");
  }

  const botId = randomUUID();
  const bot: Bot = {
    id: botId,
    ownerId,
    template,
    name: input.name,
    instructions: input.instructions || templateDef.defaultInstructions,
    allowedTools,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  await config.client.send(
    new PutCommand({
      TableName: config.tableName,
      Item: {
        pk: getBotPK(ownerId),
        sk: getBotSK(botId),
        entityType: "Bot",
        ...bot,
        gsi1pk: `BOT#${botId}`,
        gsi1sk: `BOT#${botId}`,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    })
  );

  return bot;
}

export async function getBot(
  config: RepositoryConfig,
  ownerId: string,
  botId: string
): Promise<Bot | null> {
  const result = await config.client.send(
    new GetCommand({
      TableName: config.tableName,
      Key: {
        pk: getBotPK(ownerId),
        sk: getBotSK(botId),
      },
    })
  );

  if (!result.Item || result.Item.entityType !== "Bot") {
    return null;
  }

  return itemToBot(result.Item);
}

export async function listBots(
  config: RepositoryConfig,
  ownerId: string,
  status?: BotStatus | "all"
): Promise<Bot[]> {
  const result = await config.client.send(
    new QueryCommand({
      TableName: config.tableName,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
      FilterExpression: status && status !== "all" ? "#status = :status" : undefined,
      ExpressionAttributeNames: status && status !== "all" ? { "#status": "status" } : undefined,
      ExpressionAttributeValues: {
        ":pk": getBotPK(ownerId),
        ":skPrefix": "BOT#",
        ...(status && status !== "all" ? { ":status": status } : {}),
      },
    })
  );

  return (result.Items || [])
    .filter((item) => item.entityType === "Bot")
    .map(itemToBot);
}

export async function updateBot(
  config: RepositoryConfig,
  ownerId: string,
  botId: string,
  input: UpdateBotInput,
  now = Date.now()
): Promise<Bot> {
  const existing = await getBot(config, ownerId, botId);
  if (!existing) {
    throw new RepositoryError("Bot not found", "not_found");
  }

  if (input.allowedTools) {
    const validation = validateAllowedTools(existing.template, input.allowedTools);
    if (!validation.valid) {
      throw new RepositoryError(`Invalid tools configuration`, "validation");
    }
  }

  const updates: string[] = ["#updatedAt = :updatedAt"];
  const names: Record<string, string> = { "#updatedAt": "updatedAt" };
  const values: Record<string, unknown> = { ":updatedAt": now };

  if (input.name !== undefined) {
    updates.push("#name = :name");
    names["#name"] = "name";
    values[":name"] = input.name;
  }
  if (input.instructions !== undefined) {
    updates.push("#instructions = :instructions");
    names["#instructions"] = "instructions";
    values[":instructions"] = input.instructions;
  }
  if (input.allowedTools !== undefined) {
    updates.push("#allowedTools = :allowedTools");
    names["#allowedTools"] = "allowedTools";
    values[":allowedTools"] = input.allowedTools;
  }
  if (input.status !== undefined) {
    updates.push("#status = :status");
    names["#status"] = "status";
    values[":status"] = input.status;
  }

  const result = await config.client.send(
    new UpdateCommand({
      TableName: config.tableName,
      Key: {
        pk: getBotPK(ownerId),
        sk: getBotSK(botId),
      },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );

  return itemToBot(result.Attributes!);
}

function itemToBot(item: Record<string, unknown>): Bot {
  return {
    id: item.id as string,
    ownerId: item.ownerId as string,
    parentBotId: item.parentBotId as string | undefined,
    template: item.template as BotTemplate,
    name: item.name as string,
    instructions: item.instructions as string,
    allowedTools: item.allowedTools as string[],
    status: item.status as BotStatus,
    createdAt: item.createdAt as number,
    updatedAt: item.updatedAt as number,
  };
}

export async function createMessage(
  config: RepositoryConfig,
  ownerId: string,
  input: CreateMessageInput,
  now = Date.now()
): Promise<Message> {
  const messageId = randomUUID();
  const message: Message = {
    id: messageId,
    ownerId,
    botId: input.botId,
    role: input.role,
    content: input.content,
    toolCalls: input.toolCalls,
    toolCallId: input.toolCallId,
    sources: input.sources,
    blocks: input.blocks,
    datePrecision: input.datePrecision,
    structuredFallback: input.structuredFallback,
    createdAt: now,
  };

  await config.client.send(
    new PutCommand({
      TableName: config.tableName,
      Item: {
        pk: getMessagePK(input.botId),
        sk: getMessageSK(now, messageId),
        entityType: "Message",
        ...message,
      },
    })
  );

  return message;
}

export async function getRecentMessages(
  config: RepositoryConfig,
  botId: string,
  limit = 50
): Promise<Message[]> {
  const result = await config.client.send(
    new QueryCommand({
      TableName: config.tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": getMessagePK(botId),
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (result.Items || [])
    .filter((item) => item.entityType === "Message")
    .map(itemToMessage)
    .reverse();
}

function itemToMessage(item: Record<string, unknown>): Message {
  return {
    id: item.id as string,
    ownerId: item.ownerId as string,
    botId: item.botId as string,
    role: item.role as Message["role"],
    content: item.content as string | null,
    toolCalls: item.toolCalls as Message["toolCalls"],
    toolCallId: item.toolCallId as string | undefined,
    sources: item.sources as Message["sources"],
    blocks: item.blocks as Message["blocks"],
    datePrecision: item.datePrecision as string | undefined,
    structuredFallback: item.structuredFallback as boolean | undefined,
    createdAt: item.createdAt as number,
  };
}

export async function getBotConversationHistory(
  config: RepositoryConfig,
  botId: string,
  limit = 20
): Promise<Array<{ role: string; content: string | null; tool_calls?: unknown; tool_call_id?: string }>> {
  const messages = await getRecentMessages(config, botId, limit);

  return messages.map((msg) => {
    const base: { role: string; content: string | null; tool_calls?: unknown; tool_call_id?: string } = {
      role: msg.role,
      content: msg.content,
    };

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      base.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.arguments },
      }));
    }

    if (msg.toolCallId) {
      base.tool_call_id = msg.toolCallId;
    }

    return base;
  });
}
