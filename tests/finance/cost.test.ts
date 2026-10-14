import assert from "node:assert/strict";
import { before, test } from "node:test";
import {
  getCostConfig,
  CostConfigurationError,
  findAllowedModel,
  estimateMaxCallCost,
  calculateActualCost,
  createRunTracker,
  checkAllLimits,
  recordStep,
  recordCall,
  getRemainingBudget,
  getUsageSummary,
  type CostConfig,
} from "../../shared/finance/cost";

let config: CostConfig;
before(() => {
  config = getCostConfig({
    FINANCE_BUDGET_TABLE: "TestBudgetTable",
    FINANCE_RUN_MAX_STEPS: "10",
    FINANCE_RUN_MAX_CALLS: "30",
    FINANCE_RUN_MAX_COST_USD: "1.0",
    FINANCE_RUN_MAX_DURATION_MS: "60000",
    FINANCE_DAILY_BUDGET_USD: "10.0",
  });
});

test("cost config rejects missing or invalid table name", () => {
  assert.throws(() => getCostConfig({}), CostConfigurationError);
  assert.throws(() => getCostConfig({ FINANCE_BUDGET_TABLE: "" }), CostConfigurationError);
  assert.throws(() => getCostConfig({ FINANCE_BUDGET_TABLE: "ab" }), CostConfigurationError);
  assert.throws(() => getCostConfig({ FINANCE_BUDGET_TABLE: "invalid/table" }), CostConfigurationError);
});

test("cost config parses run limits from environment", () => {
  assert.equal(config.runLimits.maxSteps, 10);
  assert.equal(config.runLimits.maxCalls, 30);
  assert.equal(config.runLimits.maxCostUsd, 1.0);
  assert.equal(config.runLimits.maxDurationMs, 60000);
  assert.equal(config.dailyBudgetUsd, 10.0);
});

test("cost config uses defaults when environment variables are missing", () => {
  const defaultConfig = getCostConfig({ FINANCE_BUDGET_TABLE: "TestTable" });
  assert.equal(defaultConfig.runLimits.maxSteps, 6);
  assert.equal(defaultConfig.runLimits.maxCalls, 20);
  assert.equal(defaultConfig.runLimits.maxCostUsd, 0.5);
  assert.equal(defaultConfig.runLimits.maxDurationMs, 50000);
  assert.equal(defaultConfig.dailyBudgetUsd, 5.0);
});

test("cost config rejects invalid numeric values", () => {
  assert.throws(() => getCostConfig({ FINANCE_BUDGET_TABLE: "T", FINANCE_RUN_MAX_STEPS: "0" }), CostConfigurationError);
  assert.throws(() => getCostConfig({ FINANCE_BUDGET_TABLE: "T", FINANCE_RUN_MAX_STEPS: "-1" }), CostConfigurationError);
  assert.throws(() => getCostConfig({ FINANCE_BUDGET_TABLE: "T", FINANCE_RUN_MAX_COST_USD: "abc" }), CostConfigurationError);
  assert.throws(() => getCostConfig({ FINANCE_BUDGET_TABLE: "T", FINANCE_DAILY_BUDGET_USD: "NaN" }), CostConfigurationError);
});

test("cost config includes default allowed models", () => {
  assert.ok(config.allowedModels.length > 0);
  const claude = findAllowedModel(config, "anthropic/claude-3.5-sonnet");
  assert.ok(claude);
  assert.equal(claude.pricing.maxInputTokens, 200_000);
  const gpt4o = findAllowedModel(config, "openai/gpt-4o");
  assert.ok(gpt4o);
});

test("cost config parses custom allowed models from JSON", () => {
  const customConfig = getCostConfig({
    FINANCE_BUDGET_TABLE: "TestTable",
    FINANCE_ALLOWED_MODELS: JSON.stringify([
      { name: "custom/model", pricing: { maxInputPrice: 1.0, maxOutputPrice: 2.0, maxInputTokens: 10000, maxOutputTokens: 1000 } },
    ]),
  });
  assert.equal(customConfig.allowedModels.length, 1);
  assert.equal(customConfig.allowedModels[0].name, "custom/model");
});

test("cost config rejects invalid allowed models JSON", () => {
  assert.throws(() => getCostConfig({ FINANCE_BUDGET_TABLE: "T", FINANCE_ALLOWED_MODELS: "not json" }), CostConfigurationError);
  assert.throws(() => getCostConfig({ FINANCE_BUDGET_TABLE: "T", FINANCE_ALLOWED_MODELS: "[]" }), CostConfigurationError);
  assert.throws(() => getCostConfig({ FINANCE_BUDGET_TABLE: "T", FINANCE_ALLOWED_MODELS: '[{"name":"m"}]' }), CostConfigurationError);
  assert.throws(() => getCostConfig({ FINANCE_BUDGET_TABLE: "T", FINANCE_ALLOWED_MODELS: '[{"pricing":{}}]' }), CostConfigurationError);
});

test("estimateMaxCallCost calculates worst-case cost correctly", () => {
  const model = { name: "test", pricing: { maxInputPrice: 3.0, maxOutputPrice: 15.0, maxInputTokens: 100000, maxOutputTokens: 8000 } };
  const cost = estimateMaxCallCost(model, 1000, 500);
  assert.equal(cost, (1000 / 1_000_000) * 3.0 + (500 / 1_000_000) * 15.0);
});

test("calculateActualCost uses actual token counts", () => {
  const model = { name: "test", pricing: { maxInputPrice: 3.0, maxOutputPrice: 15.0, maxInputTokens: 100000, maxOutputTokens: 8000 } };
  const cost = calculateActualCost(model, 1000, 200);
  assert.equal(cost, (1000 / 1_000_000) * 3.0 + (200 / 1_000_000) * 15.0);
});

test("run tracker enforces step limit", () => {
  let tracker = createRunTracker("run-1", "owner-1", config);
  for (let i = 0; i < config.runLimits.maxSteps; i++) {
    const check = checkAllLimits(tracker, "anthropic/claude-3.5-sonnet", 1000, 500);
    assert.ok(check.allowed);
    tracker = recordStep(tracker);
  }
  const finalCheck = checkAllLimits(tracker, "anthropic/claude-3.5-sonnet", 1000, 500);
  assert.ok(!finalCheck.allowed);
  assert.equal(finalCheck.reason, "max_steps_exceeded");
});

test("run tracker enforces call limit", () => {
  const lowCallConfig = getCostConfig({
    FINANCE_BUDGET_TABLE: "TestTable",
    FINANCE_RUN_MAX_CALLS: "3",
    FINANCE_RUN_MAX_STEPS: "100",
  });
  let tracker = createRunTracker("run-2", "owner-1", lowCallConfig);
  const model = findAllowedModel(lowCallConfig, "anthropic/claude-3-haiku")!;
  for (let i = 0; i < 3; i++) {
    const check = checkAllLimits(tracker, model.name, 100, 100);
    assert.ok(check.allowed);
    tracker = recordStep(tracker);
    tracker = recordCall(tracker, model, 100, 50);
  }
  const finalCheck = checkAllLimits(tracker, model.name, 100, 100);
  assert.ok(!finalCheck.allowed);
  assert.equal(finalCheck.reason, "max_calls_exceeded");
});

test("run tracker enforces cost limit", () => {
  const lowCostConfig = getCostConfig({
    FINANCE_BUDGET_TABLE: "TestTable",
    FINANCE_RUN_MAX_COST_USD: "0.001",
    FINANCE_RUN_MAX_STEPS: "100",
    FINANCE_RUN_MAX_CALLS: "100",
  });
  let tracker = createRunTracker("run-3", "owner-1", lowCostConfig);
  const model = findAllowedModel(lowCostConfig, "openai/gpt-4o")!;
  const check = checkAllLimits(tracker, model.name, 10000, 1000);
  assert.ok(!check.allowed);
  assert.equal(check.reason, "call_cost_exceeded");
});

test("run tracker enforces duration limit", () => {
  const shortDurationConfig = getCostConfig({
    FINANCE_BUDGET_TABLE: "TestTable",
    FINANCE_RUN_MAX_DURATION_MS: "1000",
  });
  const startTime = Date.now();
  const tracker = createRunTracker("run-4", "owner-1", shortDurationConfig, {}, startTime);
  const futureTime = startTime + 2000;
  const check = checkAllLimits(tracker, "anthropic/claude-3-haiku", 100, 100, futureTime);
  assert.ok(!check.allowed);
  assert.equal(check.reason, "max_duration_exceeded");
});

test("run tracker rejects unknown models", () => {
  const tracker = createRunTracker("run-5", "owner-1", config);
  const check = checkAllLimits(tracker, "unknown/model", 100, 100);
  assert.ok(!check.allowed);
  assert.equal(check.reason, "model_not_allowed");
});

test("run tracker enforces input token limit", () => {
  const tracker = createRunTracker("run-6", "owner-1", config);
  const model = findAllowedModel(config, "anthropic/claude-3.5-sonnet")!;
  const check = checkAllLimits(tracker, model.name, model.pricing.maxInputTokens + 1, 100);
  assert.ok(!check.allowed);
  assert.equal(check.reason, "input_tokens_exceeded");
});

test("run tracker enforces output token limit", () => {
  const tracker = createRunTracker("run-7", "owner-1", config);
  const model = findAllowedModel(config, "anthropic/claude-3.5-sonnet")!;
  const check = checkAllLimits(tracker, model.name, 100, model.pricing.maxOutputTokens + 1);
  assert.ok(!check.allowed);
  assert.equal(check.reason, "output_tokens_exceeded");
});

test("run tracker accurately tracks usage and remaining budget", () => {
  let tracker = createRunTracker("run-8", "owner-1", config);
  const model = findAllowedModel(config, "anthropic/claude-3-haiku")!;
  
  tracker = recordStep(tracker);
  tracker = recordCall(tracker, model, 1000, 500);
  
  const summary = getUsageSummary(tracker);
  assert.equal(summary.usage.steps, 1);
  assert.equal(summary.usage.calls, 1);
  assert.ok(summary.usage.costUsd > 0);
  
  const remaining = getRemainingBudget(tracker);
  assert.equal(remaining.steps, config.runLimits.maxSteps - 1);
  assert.equal(remaining.calls, config.runLimits.maxCalls - 1);
  assert.ok(remaining.costUsd < config.runLimits.maxCostUsd);
});

test("run tracker allows custom limits that override config defaults", () => {
  const tracker = createRunTracker("run-9", "owner-1", config, { maxSteps: 2 });
  assert.equal(tracker.limits.maxSteps, 2);
  assert.equal(tracker.limits.maxCalls, config.runLimits.maxCalls);
});
