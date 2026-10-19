import type { ChatBlock, ChatSource, ValidatedAssistantMessage } from "./types";
import { respondToolArgsSchema, structuredAssistantPayloadSchema } from "./schema";

function blockReferencesSource(block: ChatBlock): string[] {
  switch (block.type) {
    case "disclosure":
      return [block.sourceId];
    case "thesis":
      return block.evidenceSourceIds;
    case "financials":
      return block.sourceId ? [block.sourceId] : [];
    case "markdown":
      return [];
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

export function sanitizeBlocks(
  blocks: ChatBlock[],
  knownSourceIds: Set<string>,
): { blocks: ChatBlock[]; dropped: number } {
  const kept: ChatBlock[] = [];
  let dropped = 0;
  for (const block of blocks) {
    const refs = blockReferencesSource(block);
    const invalid = refs.some((id) => !knownSourceIds.has(id));
    if (invalid) {
      dropped += 1;
      continue;
    }
    kept.push(block);
  }
  return { blocks: kept, dropped };
}

export function parseStructuredPayload(raw: unknown): { ok: true; data: ReturnType<typeof structuredAssistantPayloadSchema.parse> } | { ok: false; error: string } {
  const parsed = structuredAssistantPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  return { ok: true, data: parsed.data };
}

export function validateRespondToolArgs(raw: unknown): ReturnType<typeof respondToolArgsSchema.parse> | null {
  const parsed = respondToolArgsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function buildValidatedMessage(
  payload: { bodyMarkdown: string; datePrecision?: string; blocks: ChatBlock[] },
  sources: ChatSource[],
  structuredFallback: boolean,
): ValidatedAssistantMessage {
  const known = new Set(sources.map((s) => s.id));
  const { blocks, dropped } = sanitizeBlocks(payload.blocks, known);
  return {
    bodyMarkdown: payload.bodyMarkdown,
    datePrecision: payload.datePrecision,
    blocks,
    sources,
    structuredFallback,
    droppedBlockCount: dropped,
  };
}

export function markdownFallbackFromText(text: string, sources: ChatSource[]): ValidatedAssistantMessage {
  return buildValidatedMessage(
    { bodyMarkdown: text.trim(), blocks: [] },
    sources,
    true,
  );
}
