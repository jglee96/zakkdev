import "server-only";
import type { AllowedModel, CostConfig, RunLimits } from "./config";
import { calculateActualCost, estimateMaxCallCost, findAllowedModel } from "./config";

export type RunUsage = {
  steps: number;
  calls: number;
  costUsd: number;
  startedAt: number;
};

export type RunTracker = {
  readonly runId: string;
  readonly ownerId: string;
  readonly config: CostConfig;
  readonly limits: RunLimits;
  readonly usage: RunUsage;
  readonly startedAt: number;
};

export type LimitCheckResult =
  | { allowed: true }
  | { allowed: false; reason: "max_steps_exceeded"; current: number; limit: number }
  | { allowed: false; reason: "max_calls_exceeded"; current: number; limit: number }
  | { allowed: false; reason: "max_cost_exceeded"; current: number; limit: number }
  | { allowed: false; reason: "max_duration_exceeded"; elapsed: number; limit: number }
  | { allowed: false; reason: "model_not_allowed"; model: string }
  | { allowed: false; reason: "input_tokens_exceeded"; tokens: number; limit: number }
  | { allowed: false; reason: "output_tokens_exceeded"; tokens: number; limit: number }
  | { allowed: false; reason: "call_cost_exceeded"; estimated: number; remaining: number };

export function createRunTracker(
  runId: string,
  ownerId: string,
  config: CostConfig,
  limits?: Partial<RunLimits>,
  now = Date.now()
): RunTracker {
  return {
    runId,
    ownerId,
    config,
    limits: { ...config.runLimits, ...limits },
    usage: { steps: 0, calls: 0, costUsd: 0, startedAt: now },
    startedAt: now,
  };
}

export function checkStepLimit(tracker: RunTracker): LimitCheckResult {
  if (tracker.usage.steps >= tracker.limits.maxSteps) {
    return { allowed: false, reason: "max_steps_exceeded", current: tracker.usage.steps, limit: tracker.limits.maxSteps };
  }
  return { allowed: true };
}

export function checkCallLimit(tracker: RunTracker): LimitCheckResult {
  if (tracker.usage.calls >= tracker.limits.maxCalls) {
    return { allowed: false, reason: "max_calls_exceeded", current: tracker.usage.calls, limit: tracker.limits.maxCalls };
  }
  return { allowed: true };
}

export function checkCostLimit(tracker: RunTracker, additionalCost: number): LimitCheckResult {
  if (tracker.usage.costUsd + additionalCost > tracker.limits.maxCostUsd) {
    return { allowed: false, reason: "max_cost_exceeded", current: tracker.usage.costUsd, limit: tracker.limits.maxCostUsd };
  }
  return { allowed: true };
}

export function checkDurationLimit(tracker: RunTracker, now = Date.now()): LimitCheckResult {
  const elapsed = now - tracker.startedAt;
  if (elapsed >= tracker.limits.maxDurationMs) {
    return { allowed: false, reason: "max_duration_exceeded", elapsed, limit: tracker.limits.maxDurationMs };
  }
  return { allowed: true };
}

export function checkModelAllowed(
  tracker: RunTracker,
  modelName: string,
  inputTokens: number,
  maxOutputTokens: number
): { allowed: true; model: AllowedModel; estimatedCost: number } | LimitCheckResult {
  const model = findAllowedModel(tracker.config, modelName);
  if (!model) {
    return { allowed: false, reason: "model_not_allowed", model: modelName };
  }

  if (inputTokens > model.pricing.maxInputTokens) {
    return { allowed: false, reason: "input_tokens_exceeded", tokens: inputTokens, limit: model.pricing.maxInputTokens };
  }

  if (maxOutputTokens > model.pricing.maxOutputTokens) {
    return { allowed: false, reason: "output_tokens_exceeded", tokens: maxOutputTokens, limit: model.pricing.maxOutputTokens };
  }

  const estimatedCost = estimateMaxCallCost(model, inputTokens, maxOutputTokens);
  const remaining = tracker.limits.maxCostUsd - tracker.usage.costUsd;

  if (estimatedCost > remaining) {
    return { allowed: false, reason: "call_cost_exceeded", estimated: estimatedCost, remaining };
  }

  return { allowed: true, model, estimatedCost };
}

export function checkAllLimits(
  tracker: RunTracker,
  modelName: string,
  inputTokens: number,
  maxOutputTokens: number,
  now = Date.now()
): { allowed: true; model: AllowedModel; estimatedCost: number } | LimitCheckResult {
  const stepCheck = checkStepLimit(tracker);
  if (!stepCheck.allowed) return stepCheck;

  const callCheck = checkCallLimit(tracker);
  if (!callCheck.allowed) return callCheck;

  const durationCheck = checkDurationLimit(tracker, now);
  if (!durationCheck.allowed) return durationCheck;

  return checkModelAllowed(tracker, modelName, inputTokens, maxOutputTokens);
}

export function recordStep(tracker: RunTracker): RunTracker {
  return {
    ...tracker,
    usage: { ...tracker.usage, steps: tracker.usage.steps + 1 },
  };
}

export function recordCall(
  tracker: RunTracker,
  model: AllowedModel,
  inputTokens: number,
  outputTokens: number
): RunTracker {
  const actualCost = calculateActualCost(model, inputTokens, outputTokens);
  return {
    ...tracker,
    usage: {
      ...tracker.usage,
      calls: tracker.usage.calls + 1,
      costUsd: tracker.usage.costUsd + actualCost,
    },
  };
}

export function getRemainingBudget(tracker: RunTracker): {
  steps: number;
  calls: number;
  costUsd: number;
  durationMs: number;
} {
  const now = Date.now();
  return {
    steps: Math.max(0, tracker.limits.maxSteps - tracker.usage.steps),
    calls: Math.max(0, tracker.limits.maxCalls - tracker.usage.calls),
    costUsd: Math.max(0, tracker.limits.maxCostUsd - tracker.usage.costUsd),
    durationMs: Math.max(0, tracker.limits.maxDurationMs - (now - tracker.startedAt)),
  };
}

export function getUsageSummary(tracker: RunTracker): {
  runId: string;
  ownerId: string;
  usage: RunUsage;
  limits: RunLimits;
  remaining: ReturnType<typeof getRemainingBudget>;
} {
  return {
    runId: tracker.runId,
    ownerId: tracker.ownerId,
    usage: tracker.usage,
    limits: tracker.limits,
    remaining: getRemainingBudget(tracker),
  };
}
