import { z } from "zod";

const disclosureBlockSchema = z.object({
  type: z.literal("disclosure"),
  sourceId: z.string().min(1),
  headline: z.string().optional(),
  summaryMarkdown: z.string().optional(),
});

const thesisBlockSchema = z.object({
  type: z.literal("thesis"),
  claim: z.string().min(1),
  stance: z.enum(["supports", "refutes", "neutral"]),
  evidenceSourceIds: z.array(z.string().min(1)).default([]),
});

const financialsBlockSchema = z.object({
  type: z.literal("financials"),
  sourceId: z.string().min(1).optional(),
  metricsMarkdown: z.string().min(1),
});

const markdownBlockSchema = z.object({
  type: z.literal("markdown"),
  content: z.string().min(1),
});

export const chatBlockSchema = z.discriminatedUnion("type", [
  disclosureBlockSchema,
  thesisBlockSchema,
  financialsBlockSchema,
  markdownBlockSchema,
]);

export const structuredAssistantPayloadSchema = z.object({
  bodyMarkdown: z.string(),
  datePrecision: z.string().optional(),
  blocks: z.array(chatBlockSchema).default([]),
});

export const respondToolArgsSchema = structuredAssistantPayloadSchema;

export type StructuredAssistantPayloadInput = z.infer<typeof structuredAssistantPayloadSchema>;
