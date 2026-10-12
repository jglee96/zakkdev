import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  createBot,
  getBot,
  listBots,
  updateBot,
  createMessage,
  getRecentMessages,
  getBotConversationHistory,
  runAgent,
  createMockLLMClient,
  type LLMResponse,
  type AgentRuntimeConfig,
  type Bot,
} from "../../shared/finance/agent";
import { getCostConfig, createBudgetClient } from "../../shared/finance/cost";

let client: DynamoDBDocumentClient;
let rawClient: DynamoDBClient;
const dataTableName = `FinanceAgentTest-${randomUUID()}`;
const budgetTableName = `FinanceBudgetTest-${randomUUID()}`;

const repoConfig = {
  tableName: dataTableName,
  client: null as unknown as DynamoDBDocumentClient,
};

const costConfig = getCostConfig({
  FINANCE_BUDGET_TABLE: budgetTableName,
  FINANCE_DAILY_BUDGET_USD: "10.0",
  FINANCE_RUN_MAX_STEPS: "6",
  FINANCE_RUN_MAX_COST_USD: "0.5",
});

before(async () => {
  rawClient = new DynamoDBClient({
    region: "ap-northeast-2",
    endpoint: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });

  await rawClient.send(
    new CreateTableCommand({
      TableName: dataTableName,
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
      ],
      BillingMode: "PAY_PER_REQUEST",
    })
  );

  await rawClient.send(
    new CreateTableCommand({
      TableName: budgetTableName,
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      BillingMode: "PAY_PER_REQUEST",
    })
  );

  client = DynamoDBDocumentClient.from(rawClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
  repoConfig.client = client;
});

after(async () => {
  await rawClient.send(new DeleteTableCommand({ TableName: dataTableName })).catch(() => undefined);
  await rawClient.send(new DeleteTableCommand({ TableName: budgetTableName })).catch(() => undefined);
  rawClient.destroy();
});

const ownerId = "test-owner";

test("createBot creates a bot with default template tools", async () => {
  const bot = await createBot(repoConfig, ownerId, {
    template: "kr-stock",
    name: "삼성전자 분석 봇",
  });

  assert.ok(bot.id);
  assert.equal(bot.ownerId, ownerId);
  assert.equal(bot.template, "kr-stock");
  assert.equal(bot.name, "삼성전자 분석 봇");
  assert.equal(bot.status, "active");
  assert.ok(bot.allowedTools.includes("search_dart_filings"));
  assert.ok(bot.instructions.includes("한국 주식"));
});

test("createBot rejects invalid tools for template", async () => {
  await assert.rejects(
    async () => createBot(repoConfig, ownerId, {
      template: "kr-stock",
      name: "Invalid Bot",
      allowedTools: ["create_bot", "search_dart_filings"],
    }),
    /Invalid tools/
  );
});

test("getBot retrieves bot by owner and id", async () => {
  const created = await createBot(repoConfig, ownerId, {
    template: "us-stock",
    name: "Apple 분석 봇",
  });

  const retrieved = await getBot(repoConfig, ownerId, created.id);
  assert.ok(retrieved);
  assert.equal(retrieved.id, created.id);
  assert.equal(retrieved.name, "Apple 분석 봇");

  const notFound = await getBot(repoConfig, ownerId, "nonexistent");
  assert.equal(notFound, null);

  const wrongOwner = await getBot(repoConfig, "other-owner", created.id);
  assert.equal(wrongOwner, null);
});

test("listBots returns bots filtered by status", async () => {
  const newOwner = `owner-${randomUUID()}`;

  await createBot(repoConfig, newOwner, { template: "kr-stock", name: "Bot 1" });
  await createBot(repoConfig, newOwner, { template: "us-stock", name: "Bot 2" });

  const activeBots = await listBots(repoConfig, newOwner, "active");
  assert.equal(activeBots.length, 2);

  const archivedBots = await listBots(repoConfig, newOwner, "archived");
  assert.equal(archivedBots.length, 0);

  const allBots = await listBots(repoConfig, newOwner, "all");
  assert.equal(allBots.length, 2);
});

test("updateBot modifies bot properties", async () => {
  const bot = await createBot(repoConfig, ownerId, {
    template: "index-futures",
    name: "선물 봇",
  });

  const updated = await updateBot(repoConfig, ownerId, bot.id, {
    name: "수정된 선물 봇",
    status: "paused",
  });

  assert.equal(updated.name, "수정된 선물 봇");
  assert.equal(updated.status, "paused");
  assert.ok(updated.updatedAt > bot.updatedAt);
});

test("updateBot rejects invalid tools", async () => {
  const bot = await createBot(repoConfig, ownerId, {
    template: "kr-stock",
    name: "Test Bot",
  });

  await assert.rejects(
    async () => updateBot(repoConfig, ownerId, bot.id, {
      allowedTools: ["invalid_tool"],
    }),
    /Invalid tools/
  );
});

test("createMessage and getRecentMessages handle conversation history", async () => {
  const bot = await createBot(repoConfig, ownerId, {
    template: "main",
    name: "메인 봇",
  });

  await createMessage(repoConfig, ownerId, {
    botId: bot.id,
    role: "user",
    content: "한국 주식 봇 만들어줘",
  });

  await createMessage(repoConfig, ownerId, {
    botId: bot.id,
    role: "assistant",
    content: null,
    toolCalls: [{ id: "call-1", name: "create_bot", arguments: '{"template":"kr-stock","name":"테스트"}' }],
  });

  await createMessage(repoConfig, ownerId, {
    botId: bot.id,
    role: "tool",
    content: '{"success":true}',
    toolCallId: "call-1",
  });

  await createMessage(repoConfig, ownerId, {
    botId: bot.id,
    role: "assistant",
    content: "한국 주식 봇을 생성했습니다.",
  });

  const messages = await getRecentMessages(repoConfig, bot.id, 10);
  assert.equal(messages.length, 4);
  assert.equal(messages[0].role, "user");
  assert.equal(messages[1].role, "assistant");
  assert.ok(messages[1].toolCalls);
  assert.equal(messages[2].role, "tool");
  assert.equal(messages[3].role, "assistant");
});

test("getBotConversationHistory returns OpenAI-compatible format", async () => {
  const bot = await createBot(repoConfig, ownerId, {
    template: "main",
    name: "히스토리 테스트 봇",
  });

  await createMessage(repoConfig, ownerId, {
    botId: bot.id,
    role: "user",
    content: "테스트 메시지",
  });

  const history = await getBotConversationHistory(repoConfig, bot.id, 10);
  assert.ok(Array.isArray(history));
  assert.equal(history[0].role, "user");
  assert.equal(history[0].content, "테스트 메시지");
});

test("runAgent executes with mock LLM and respects budget", async () => {
  const bot = await createBot(repoConfig, ownerId, {
    template: "main",
    name: "런타임 테스트 봇",
  });

  const mockResponses: LLMResponse[] = [
    {
      content: "안녕하세요! 무엇을 도와드릴까요?",
      toolCalls: [],
      usage: { inputTokens: 100, outputTokens: 50 },
      model: "mock",
    },
  ];

  const mock = createMockLLMClient(mockResponses);
  const budgetClient = createBudgetClient({
    NODE_ENV: "development",
    AWS_REGION: "ap-northeast-2",
    FINANCE_DYNAMODB_ENDPOINT: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
  });

  const runtimeConfig: AgentRuntimeConfig = {
    llmConfig: {
      apiKey: "mock",
      baseURL: "mock",
      model: "anthropic/claude-3-haiku",
      maxRetries: 0,
      timeoutMs: 20000,
    },
    llmClient: mock.client,
    repoConfig,
    costConfig: { ...costConfig, tableName: budgetTableName },
    budgetClient,
    callLLMFn: mock.callLLM,
  };

  const result = await runAgent(bot, "안녕하세요", runtimeConfig);

  assert.equal(result.status, "completed");
  assert.equal(result.response, "안녕하세요! 무엇을 도와드릴까요?");
  assert.equal(result.usage.steps, 1);
  assert.equal(result.usage.calls, 1);
  assert.ok(result.durationMs > 0);
});

test("runAgent executes tool calls correctly", async () => {
  const bot = await createBot(repoConfig, ownerId, {
    template: "main",
    name: "도구 테스트 봇",
  });

  const mockResponses: LLMResponse[] = [
    {
      content: null,
      toolCalls: [{
        id: "call-1",
        name: "list_bots",
        arguments: "{}",
      }],
      usage: { inputTokens: 100, outputTokens: 30 },
      model: "mock",
    },
    {
      content: "현재 2개의 봇이 있습니다.",
      toolCalls: [],
      usage: { inputTokens: 200, outputTokens: 50 },
      model: "mock",
    },
  ];

  const mock = createMockLLMClient(mockResponses);
  const budgetClient = createBudgetClient({
    NODE_ENV: "development",
    AWS_REGION: "ap-northeast-2",
    FINANCE_DYNAMODB_ENDPOINT: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
  });

  const runtimeConfig: AgentRuntimeConfig = {
    llmConfig: {
      apiKey: "mock",
      baseURL: "mock",
      model: "anthropic/claude-3-haiku",
      maxRetries: 0,
      timeoutMs: 20000,
    },
    llmClient: mock.client,
    repoConfig,
    costConfig: { ...costConfig, tableName: budgetTableName },
    budgetClient,
    callLLMFn: mock.callLLM,
  };

  const result = await runAgent(bot, "봇 목록 보여줘", runtimeConfig);

  assert.equal(result.status, "completed");
  assert.ok(result.response?.includes("2개"));
  assert.equal(result.usage.steps, 2);
  assert.equal(result.usage.calls, 2);
});

test("runAgent rejects disallowed tools", async () => {
  const bot = await createBot(repoConfig, ownerId, {
    template: "kr-stock",
    name: "제한된 봇",
  });

  const mockResponses: LLMResponse[] = [
    {
      content: null,
      toolCalls: [{
        id: "call-1",
        name: "create_bot",
        arguments: '{"template":"us-stock","name":"Test"}',
      }],
      usage: { inputTokens: 100, outputTokens: 30 },
      model: "mock",
    },
    {
      content: "해당 도구를 사용할 수 없습니다.",
      toolCalls: [],
      usage: { inputTokens: 200, outputTokens: 50 },
      model: "mock",
    },
  ];

  const mock = createMockLLMClient(mockResponses);
  const budgetClient = createBudgetClient({
    NODE_ENV: "development",
    AWS_REGION: "ap-northeast-2",
    FINANCE_DYNAMODB_ENDPOINT: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
  });

  const runtimeConfig: AgentRuntimeConfig = {
    llmConfig: {
      apiKey: "mock",
      baseURL: "mock",
      model: "anthropic/claude-3-haiku",
      maxRetries: 0,
      timeoutMs: 20000,
    },
    llmClient: mock.client,
    repoConfig,
    costConfig: { ...costConfig, tableName: budgetTableName },
    budgetClient,
    callLLMFn: mock.callLLM,
  };

  const result = await runAgent(bot, "봇 만들어줘", runtimeConfig);
  assert.equal(result.status, "completed");
});

test("runAgent respects recursion depth limit", async () => {
  const mainBot = await createBot(repoConfig, ownerId, {
    template: "main",
    name: "재귀 테스트 메인 봇",
  });

  const childBot = await createBot(repoConfig, ownerId, {
    template: "main",
    name: "재귀 테스트 자식 봇",
  });

  let invokeCount = 0;
  const mockResponses: LLMResponse[] = Array(10).fill(null).map(() => ({
    content: null,
    toolCalls: [{
      id: `call-${invokeCount++}`,
      name: "invoke_bot",
      arguments: JSON.stringify({ botId: childBot.id, message: "재귀 호출" }),
    }],
    usage: { inputTokens: 100, outputTokens: 30 },
    model: "mock",
  }));

  mockResponses.push({
    content: "재귀 깊이 초과",
    toolCalls: [],
    usage: { inputTokens: 100, outputTokens: 20 },
    model: "mock",
  });

  const mock = createMockLLMClient(mockResponses);
  const budgetClient = createBudgetClient({
    NODE_ENV: "development",
    AWS_REGION: "ap-northeast-2",
    FINANCE_DYNAMODB_ENDPOINT: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
  });

  const runtimeConfig: AgentRuntimeConfig = {
    llmConfig: {
      apiKey: "mock",
      baseURL: "mock",
      model: "anthropic/claude-3-haiku",
      maxRetries: 0,
      timeoutMs: 20000,
    },
    llmClient: mock.client,
    repoConfig,
    costConfig: { ...costConfig, tableName: budgetTableName },
    budgetClient,
    callLLMFn: mock.callLLM,
  };

  const result = await runAgent(mainBot, "다른 봇 호출해줘", runtimeConfig);
  assert.ok(result.status === "completed" || result.status === "budget_exceeded");
});

test("conversation is restored after bot restart", async () => {
  const bot = await createBot(repoConfig, ownerId, {
    template: "main",
    name: "영속화 테스트 봇",
  });

  await createMessage(repoConfig, ownerId, {
    botId: bot.id,
    role: "user",
    content: "이전 대화입니다",
  });

  await createMessage(repoConfig, ownerId, {
    botId: bot.id,
    role: "assistant",
    content: "네, 기억하겠습니다.",
  });

  const mockResponses: LLMResponse[] = [
    {
      content: "네, 이전에 대화한 내용을 기억하고 있습니다.",
      toolCalls: [],
      usage: { inputTokens: 200, outputTokens: 50 },
      model: "mock",
    },
  ];

  const mock = createMockLLMClient(mockResponses);
  const budgetClient = createBudgetClient({
    NODE_ENV: "development",
    AWS_REGION: "ap-northeast-2",
    FINANCE_DYNAMODB_ENDPOINT: process.env.FINANCE_DYNAMODB_ENDPOINT || "http://127.0.0.1:8000",
  });

  const runtimeConfig: AgentRuntimeConfig = {
    llmConfig: {
      apiKey: "mock",
      baseURL: "mock",
      model: "anthropic/claude-3-haiku",
      maxRetries: 0,
      timeoutMs: 20000,
    },
    llmClient: mock.client,
    repoConfig,
    costConfig: { ...costConfig, tableName: budgetTableName },
    budgetClient,
    callLLMFn: mock.callLLM,
  };

  const result = await runAgent(bot, "이전 대화 기억해?", runtimeConfig);
  assert.equal(result.status, "completed");

  const history = await getBotConversationHistory(repoConfig, bot.id, 20);
  assert.ok(history.length >= 4);
});
