import "server-only";

export type ModelPricing = {
  readonly maxInputPrice: number;
  readonly maxOutputPrice: number;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
};

export type AllowedModel = {
  readonly name: string;
  readonly provider?: string;
  readonly pricing: ModelPricing;
};

export type RunLimits = {
  readonly maxSteps: number;
  readonly maxCalls: number;
  readonly maxCostUsd: number;
  readonly maxDurationMs: number;
};

export type CostConfig = {
  readonly runLimits: RunLimits;
  readonly dailyBudgetUsd: number;
  readonly allowedModels: ReadonlyArray<AllowedModel>;
  readonly tableName: string;
};

export class CostConfigurationError extends Error {
  constructor(message = "Cost configuration is invalid or missing") {
    super(message);
  }
}

const DEFAULT_ALLOWED_MODELS: ReadonlyArray<AllowedModel> = [
  {
    name: "anthropic/claude-3.5-sonnet",
    pricing: { maxInputPrice: 3.0, maxOutputPrice: 15.0, maxInputTokens: 200_000, maxOutputTokens: 8_192 },
  },
  {
    name: "anthropic/claude-3-haiku",
    pricing: { maxInputPrice: 0.25, maxOutputPrice: 1.25, maxInputTokens: 200_000, maxOutputTokens: 4_096 },
  },
  {
    name: "openai/gpt-4o",
    pricing: { maxInputPrice: 2.5, maxOutputPrice: 10.0, maxInputTokens: 128_000, maxOutputTokens: 16_384 },
  },
  {
    name: "openai/gpt-4o-mini",
    pricing: { maxInputPrice: 0.15, maxOutputPrice: 0.6, maxInputTokens: 128_000, maxOutputTokens: 16_384 },
  },
  {
    name: "google/gemini-pro-1.5",
    pricing: { maxInputPrice: 1.25, maxOutputPrice: 5.0, maxInputTokens: 2_000_000, maxOutputTokens: 8_192 },
  },
  {
    name: "google/gemini-flash-1.5",
    pricing: { maxInputPrice: 0.075, maxOutputPrice: 0.3, maxInputTokens: 1_000_000, maxOutputTokens: 8_192 },
  },
];

const DEFAULT_RUN_LIMITS: RunLimits = {
  maxSteps: 6,
  maxCalls: 20,
  maxCostUsd: 0.5,
  maxDurationMs: 50_000,
};

const DEFAULT_DAILY_BUDGET_USD = 5.0;

function parsePositiveNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) throw new CostConfigurationError(`Invalid positive number: ${value}`);
  return num;
}

function parsePositiveInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) throw new CostConfigurationError(`Invalid positive integer: ${value}`);
  return num;
}

export function getCostConfig(env: Partial<NodeJS.ProcessEnv> = process.env): CostConfig {
  const tableName = env.FINANCE_BUDGET_TABLE;
  if (!tableName || !/^[A-Za-z0-9_.-]{3,255}$/.test(tableName)) {
    throw new CostConfigurationError("FINANCE_BUDGET_TABLE is not configured");
  }

  const runLimits: RunLimits = {
    maxSteps: parsePositiveInt(env.FINANCE_RUN_MAX_STEPS, DEFAULT_RUN_LIMITS.maxSteps),
    maxCalls: parsePositiveInt(env.FINANCE_RUN_MAX_CALLS, DEFAULT_RUN_LIMITS.maxCalls),
    maxCostUsd: parsePositiveNumber(env.FINANCE_RUN_MAX_COST_USD, DEFAULT_RUN_LIMITS.maxCostUsd),
    maxDurationMs: parsePositiveInt(env.FINANCE_RUN_MAX_DURATION_MS, DEFAULT_RUN_LIMITS.maxDurationMs),
  };

  const dailyBudgetUsd = parsePositiveNumber(env.FINANCE_DAILY_BUDGET_USD, DEFAULT_DAILY_BUDGET_USD);

  let allowedModels = DEFAULT_ALLOWED_MODELS;
  if (env.FINANCE_ALLOWED_MODELS) {
    try {
      const parsed = JSON.parse(env.FINANCE_ALLOWED_MODELS);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new CostConfigurationError("FINANCE_ALLOWED_MODELS must be a non-empty array");
      }
      allowedModels = parsed.map((model: unknown, i: number) => {
        if (typeof model !== "object" || model === null) {
          throw new CostConfigurationError(`Invalid model at index ${i}`);
        }
        const m = model as Record<string, unknown>;
        if (typeof m.name !== "string" || !m.name) {
          throw new CostConfigurationError(`Model at index ${i} must have a name`);
        }
        if (typeof m.pricing !== "object" || m.pricing === null) {
          throw new CostConfigurationError(`Model at index ${i} must have pricing`);
        }
        const p = m.pricing as Record<string, unknown>;
        for (const key of ["maxInputPrice", "maxOutputPrice", "maxInputTokens", "maxOutputTokens"]) {
          if (typeof p[key] !== "number" || !Number.isFinite(p[key] as number) || (p[key] as number) <= 0) {
            throw new CostConfigurationError(`Model at index ${i} pricing.${key} must be a positive number`);
          }
        }
        return {
          name: m.name as string,
          provider: typeof m.provider === "string" ? m.provider : undefined,
          pricing: {
            maxInputPrice: p.maxInputPrice as number,
            maxOutputPrice: p.maxOutputPrice as number,
            maxInputTokens: p.maxInputTokens as number,
            maxOutputTokens: p.maxOutputTokens as number,
          },
        };
      });
    } catch (e) {
      if (e instanceof CostConfigurationError) throw e;
      throw new CostConfigurationError("FINANCE_ALLOWED_MODELS is not valid JSON");
    }
  }

  return { runLimits, dailyBudgetUsd, allowedModels, tableName };
}

export function findAllowedModel(config: CostConfig, modelName: string): AllowedModel | undefined {
  return config.allowedModels.find((m) => m.name === modelName);
}

export function estimateMaxCallCost(model: AllowedModel, inputTokens: number, maxOutputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * model.pricing.maxInputPrice;
  const outputCost = (maxOutputTokens / 1_000_000) * model.pricing.maxOutputPrice;
  return inputCost + outputCost;
}

export function calculateActualCost(model: AllowedModel, inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * model.pricing.maxInputPrice;
  const outputCost = (outputTokens / 1_000_000) * model.pricing.maxOutputPrice;
  return inputCost + outputCost;
}
