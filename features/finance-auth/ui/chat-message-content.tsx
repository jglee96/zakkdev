"use client";

import type { ChatBlock, ChatSource } from "@/shared/finance/chat/types";
import { StructuredMessageBody } from "./structured-chat-cards";
import { parseLegacyAssistantMessage } from "./legacy-assistant-message";

export type { ParsedAssistantMessage, ParsedSource } from "./legacy-assistant-message";

export function ChatMessageContent({
  content,
  blocks,
  sources,
  datePrecision,
  structuredFallback,
}: {
  content: string;
  blocks?: ChatBlock[];
  sources?: ChatSource[];
  datePrecision?: string;
  structuredFallback?: boolean;
}) {
  const hasStructured = Boolean(blocks?.length || sources?.length || datePrecision);

  if (hasStructured) {
    return (
      <StructuredMessageBody
        bodyMarkdown={content}
        blocks={blocks}
        sources={sources}
        datePrecision={datePrecision}
        structuredFallback={structuredFallback}
      />
    );
  }

  const legacy = parseLegacyAssistantMessage(content);
  const legacySources: ChatSource[] = legacy.sources.map((s, i) => ({
    id: `legacy:${i}`,
    provider: s.provider === "DART" ? "dart" : "other",
    title: s.title,
    url: s.url,
    filingDate: s.filingDate,
    timePrecision: s.filingDate ? "date" : "unknown",
    firstSeenAt: 0,
  }));

  return (
    <StructuredMessageBody
      bodyMarkdown={legacy.bodyMarkdown}
      sources={legacySources}
      datePrecision={legacy.datePrecision}
      structuredFallback
    />
  );
}
