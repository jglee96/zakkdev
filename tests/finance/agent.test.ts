import assert from "node:assert/strict";
import { before, test } from "node:test";
import {
  isValidTemplate,
  validateAllowedTools,
  getDefaultTools,
  getTemplateDefinition,
  MAIN_BOT_TOOLS,
  KR_STOCK_TOOLS,
  US_STOCK_TOOLS,
  INDEX_FUTURES_TOOLS,
} from "../../shared/finance/agent/templates";
import {
  getToolDefinition,
  getToolsForTemplate,
  getToolsForBot,
  isToolAllowed,
  parseToolArguments,
  TOOL_DEFINITIONS,
} from "../../shared/finance/agent/tool-registry";
import {
  createLLMConfig,
  LLMProviderError,
  createMockLLMClient,
  type LLMResponse,
} from "../../shared/finance/agent/llm-provider";
import {
  MAX_RECURSION_DEPTH,
  SYNC_DEADLINE_MS,
  SYNC_CALL_TIMEOUT_MS,
} from "../../shared/finance/agent/types";

test("template validation accepts valid templates and rejects invalid ones", () => {
  assert.ok(isValidTemplate("main"));
  assert.ok(isValidTemplate("kr-stock"));
  assert.ok(isValidTemplate("us-stock"));
  assert.ok(isValidTemplate("index-futures"));
  assert.ok(!isValidTemplate("invalid"));
  assert.ok(!isValidTemplate(""));
});

test("template definitions have required properties", () => {
  for (const template of ["main", "kr-stock", "us-stock", "index-futures"] as const) {
    const def = getTemplateDefinition(template);
    assert.ok(def.name);
    assert.ok(def.description);
    assert.ok(def.defaultInstructions);
    assert.ok(Array.isArray(def.allowedTools));
    assert.ok(Array.isArray(def.requiredTools));
  }
});

test("validateAllowedTools checks tools correctly", () => {
  const mainValid = validateAllowedTools("main", [...MAIN_BOT_TOOLS]);
  assert.ok(mainValid.valid);
  assert.deepEqual(mainValid.invalidTools, []);
  assert.deepEqual(mainValid.missingRequired, []);

  const mainMissingRequired = validateAllowedTools("main", ["invoke_bot"]);
  assert.ok(!mainMissingRequired.valid);
  assert.ok(mainMissingRequired.missingRequired.includes("create_bot"));
  assert.ok(mainMissingRequired.missingRequired.includes("list_bots"));

  const krWithInvalid = validateAllowedTools("kr-stock", ["search_dart_filings", "find_relevant_theses", "create_bot"]);
  assert.ok(!krWithInvalid.valid);
  assert.deepEqual(krWithInvalid.invalidTools, ["create_bot"]);
});

test("getDefaultTools returns correct tools for each template", () => {
  assert.deepEqual(getDefaultTools("main"), [...MAIN_BOT_TOOLS]);
  assert.deepEqual(getDefaultTools("kr-stock"), [...KR_STOCK_TOOLS]);
  assert.deepEqual(getDefaultTools("us-stock"), [...US_STOCK_TOOLS]);
  assert.deepEqual(getDefaultTools("index-futures"), [...INDEX_FUTURES_TOOLS]);
});

test("tool definitions have required structure", () => {
  for (const [name, def] of Object.entries(TOOL_DEFINITIONS)) {
    assert.equal(def.name, name);
    assert.ok(def.description);
    assert.ok(def.parameters);
    assert.equal(typeof def.requiresAuth, "boolean");
    assert.equal(typeof def.mutates, "boolean");
  }
});

test("getToolsForTemplate returns OpenAI-compatible tool format", () => {
  const mainTools = getToolsForTemplate("main");
  assert.ok(mainTools.length > 0);
  for (const tool of mainTools) {
    assert.equal(tool.type, "function");
    const fn = (tool as { type: "function"; function: { name: string; description?: string; parameters?: unknown } }).function;
    assert.ok(fn.name);
    assert.ok(fn.description);
    assert.ok(fn.parameters);
  }
});

test("getToolsForBot filters tools by allowed list", () => {
  const allTools = getToolsForBot(["create_bot", "list_bots"]);
  assert.equal(allTools.length, 2);
  const toolNames = allTools.map((t) => (t as { type: "function"; function: { name: string } }).function.name);
  assert.ok(toolNames.includes("create_bot"));
  assert.ok(toolNames.includes("list_bots"));
  assert.ok(!toolNames.includes("invoke_bot"));
});

test("isToolAllowed checks tool permission correctly", () => {
  assert.ok(isToolAllowed("create_bot", ["create_bot", "list_bots"]));
  assert.ok(!isToolAllowed("invoke_bot", ["create_bot", "list_bots"]));
});

test("parseToolArguments handles valid and invalid JSON", () => {
  assert.deepEqual(parseToolArguments('{"name":"test"}'), { name: "test" });
  assert.deepEqual(parseToolArguments("invalid"), {});
  assert.deepEqual(parseToolArguments(""), {});
});

test("LLM config requires OPENROUTER_API_KEY", () => {
  assert.throws(
    () => createLLMConfig({}),
    (error) => error instanceof LLMProviderError && error.code === "config_error"
  );

  const config = createLLMConfig({ OPENROUTER_API_KEY: "test-key" });
  assert.equal(config.apiKey, "test-key");
  assert.equal(config.baseURL, "https://openrouter.ai/api/v1");
  assert.equal(config.maxRetries, 0);
});

test("LLM config respects custom settings", () => {
  const config = createLLMConfig({
    OPENROUTER_API_KEY: "test-key",
    OPENROUTER_BASE_URL: "https://custom.example/v1",
    FINANCE_MODEL: "custom/model",
    FINANCE_LLM_TIMEOUT_MS: "30000",
  });
  assert.equal(config.baseURL, "https://custom.example/v1");
  assert.equal(config.model, "custom/model");
  assert.equal(config.timeoutMs, 30000);
});

test("mock LLM client returns configured responses", async () => {
  const responses: LLMResponse[] = [
    {
      content: "First response",
      toolCalls: [],
      usage: { inputTokens: 100, outputTokens: 50 },
      model: "mock",
    },
    {
      content: null,
      toolCalls: [{ id: "call-1", name: "create_bot", arguments: '{"template":"kr-stock","name":"Test"}' }],
      usage: { inputTokens: 150, outputTokens: 30 },
      model: "mock",
    },
  ];

  const mock = createMockLLMClient(responses);

  const first = await mock.callLLM(mock.client, {} as any, { messages: [] });
  assert.equal(first.content, "First response");
  assert.equal(first.toolCalls.length, 0);

  const second = await mock.callLLM(mock.client, {} as any, { messages: [] });
  assert.equal(second.content, null);
  assert.equal(second.toolCalls.length, 1);
  assert.equal(second.toolCalls[0].name, "create_bot");
});

test("agent constants are properly configured", () => {
  assert.equal(MAX_RECURSION_DEPTH, 3);
  assert.equal(SYNC_DEADLINE_MS, 50000);
  assert.equal(SYNC_CALL_TIMEOUT_MS, 20000);
});

test("main bot tools include required management tools", () => {
  assert.ok(MAIN_BOT_TOOLS.includes("create_bot"));
  assert.ok(MAIN_BOT_TOOLS.includes("list_bots"));
  assert.ok(MAIN_BOT_TOOLS.includes("update_bot"));
  assert.ok(MAIN_BOT_TOOLS.includes("invoke_bot"));
});

test("kr-stock tools include DART and thesis tools", () => {
  assert.ok(KR_STOCK_TOOLS.includes("search_dart_filings"));
  assert.ok(KR_STOCK_TOOLS.includes("get_financials"));
  assert.ok(KR_STOCK_TOOLS.includes("find_relevant_theses"));
  assert.ok(KR_STOCK_TOOLS.includes("save_insight"));
});
