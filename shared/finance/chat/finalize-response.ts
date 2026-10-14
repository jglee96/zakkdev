import type OpenAI from "openai";
import type { LLMConfig, LLMCallOptions } from "../agent/llm-provider";
import { callLLM } from "../agent/llm-provider";
import type { SourceRegistry } from "./source-registry";
import type { ValidatedAssistantMessage } from "./types";
import {
  buildValidatedMessage,
  markdownFallbackFromText,
  parseStructuredPayload,
  validateRespondToolArgs,
} from "./validate-response";
import { structuredAssistantPayloadSchema } from "./schema";

const STRUCTURED_SYSTEM = `You format the assistant's final answer as JSON matching the schema.
Use only sourceId values from the provided collectedSources list for block citations.
Never invent URLs. bodyMarkdown is user-facing markdown without a sources footer.`;

export type FinalizeContext = {
  readonly client: OpenAI;
  readonly llmConfig: LLMConfig;
  readonly sourceRegistry: SourceRegistry;
  readonly draftMarkdown: string;
};

export type FinalizeResult = {
  message: ValidatedAssistantMessage;
  repairAttempted: boolean;
  repairUsage?: { inputTokens: number; outputTokens: number };
};

export async function finalizeFromRespondTool(
  args: Record<string, unknown>,
  sourceRegistry: SourceRegistry,
): Promise<ValidatedAssistantMessage | null> {
  const parsed = validateRespondToolArgs(args);
  if (!parsed) return null;
  return buildValidatedMessage(parsed, sourceRegistry.list(), false);
}

export async function finalizeAssistantResponse(ctx: FinalizeContext): Promise<FinalizeResult> {
  const sources = ctx.sourceRegistry.list();
  const trimmed = ctx.draftMarkdown.trim();

  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed) as unknown;
      const parsed = parseStructuredPayload(json);
      if (parsed.ok) {
        return {
          message: buildValidatedMessage(parsed.data, sources, false),
          repairAttempted: false,
        };
      }
    } catch {
      /* fall through */
    }
  }

  if (!trimmed) {
    return {
      message: buildValidatedMessage({ bodyMarkdown: "", blocks: [] }, sources, true),
      repairAttempted: false,
    };
  }

  if (!trimmed.startsWith("{")) {
    return {
      message: markdownFallbackFromText(trimmed, sources),
      repairAttempted: false,
    };
  }

  const repairMessages: LLMCallOptions["messages"] = [
    { role: "system", content: STRUCTURED_SYSTEM },
    {
      role: "user",
      content: JSON.stringify({
        collectedSources: sources.map((s) => ({
          id: s.id,
          title: s.title,
          provider: s.provider,
          filingDate: s.filingDate,
          timePrecision: s.timePrecision,
        })),
        draftAnswer: trimmed,
        schemaHint: "bodyMarkdown, optional datePrecision, blocks[] with type disclosure|thesis|financials|markdown",
      }),
    },
  ];

  try {
    const response = await callLLM(ctx.client, ctx.llmConfig, {
      messages: [
        ...repairMessages,
        {
          role: "user",
          content:
            'Return ONLY valid JSON: {"bodyMarkdown":string,"datePrecision"?:string,"blocks":array}',
        },
      ],
      temperature: 0,
      maxTokens: 2048,
    });

    const repairText = response.content?.trim() || "";
    if (repairText.startsWith("{")) {
      const parsed = parseStructuredPayload(JSON.parse(repairText));
      if (parsed.ok) {
        return {
          message: buildValidatedMessage(parsed.data, sources, false),
          repairAttempted: true,
          repairUsage: response.usage,
        };
      }
    }
  } catch {
    /* repair failed */
  }

  return {
    message: markdownFallbackFromText(trimmed, sources),
    repairAttempted: true,
  };
}
