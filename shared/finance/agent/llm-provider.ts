import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

export type LLMConfig = {
  readonly apiKey: string;
  readonly baseURL: string;
  readonly model: string;
  readonly fallbackModel?: string;
  readonly maxRetries: number;
  readonly timeoutMs: number;
};

export type LLMCallOptions = {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type LLMResponse = {
  content: string | null;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
};

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "timeout" | "api_error" | "config_error" | "aborted",
    public readonly cause?: unknown
  ) {
    super(message);
  }
}

export function createLLMConfig(env: Partial<NodeJS.ProcessEnv> = process.env): LLMConfig {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new LLMProviderError("OPENROUTER_API_KEY is not configured", "config_error");
  }

  const baseURL = env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const model = env.FINANCE_MODEL || "anthropic/claude-3-haiku";
  const fallbackModel = env.FINANCE_FALLBACK_MODEL;
  const timeoutMs = Number(env.FINANCE_LLM_TIMEOUT_MS) || 20000;

  return {
    apiKey,
    baseURL,
    model,
    fallbackModel,
    maxRetries: 0,
    timeoutMs,
  };
}

export function createLLMClient(config: LLMConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    maxRetries: config.maxRetries,
    timeout: config.timeoutMs,
  });
}

export async function callLLM(
  client: OpenAI,
  config: LLMConfig,
  options: LLMCallOptions
): Promise<LLMResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const completion = await client.chat.completions.create(
      {
        model: config.model,
        messages: options.messages,
        tools: options.tools && options.tools.length > 0 ? options.tools : undefined,
        tool_choice: options.tools && options.tools.length > 0 ? "auto" : undefined,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const message = completion.choices[0]?.message;
    if (!message) {
      throw new LLMProviderError("No response from LLM", "api_error");
    }

    const toolCalls = (message.tool_calls || [])
      .filter((tc) => tc.type === "function")
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

    return {
      content: message.content,
      toolCalls,
      usage: {
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
      },
      model: completion.model || config.model,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      if (options.signal?.aborted) {
        throw new LLMProviderError("LLM call aborted by caller", "aborted", error);
      }
      throw new LLMProviderError("LLM call timed out", "timeout", error);
    }

    throw new LLMProviderError(
      error instanceof Error ? error.message : "LLM call failed",
      "api_error",
      error
    );
  }
}

export type MockLLMResponse = LLMResponse | ((options: LLMCallOptions) => LLMResponse | Promise<LLMResponse>);

export function createMockLLMClient(responses: MockLLMResponse[]): {
  client: OpenAI;
  callLLM: (client: OpenAI, config: LLMConfig, options: LLMCallOptions) => Promise<LLMResponse>;
} {
  let callIndex = 0;

  const mockCallLLM = async (_client: OpenAI, _config: LLMConfig, options: LLMCallOptions): Promise<LLMResponse> => {
    if (callIndex >= responses.length) {
      return {
        content: "No more mock responses",
        toolCalls: [],
        usage: { inputTokens: 0, outputTokens: 0 },
        model: "mock",
      };
    }

    const response = responses[callIndex++];
    if (typeof response === "function") {
      return response(options);
    }
    return response;
  };

  return {
    client: {} as OpenAI,
    callLLM: mockCallLLM,
  };
}
