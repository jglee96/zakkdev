"use client";

import { Anchor, Badge, Box, Card, Group, Stack, Text } from "@mantine/core";
import { IconCalendar, IconExternalLink } from "@tabler/icons-react";
import { FinanceMarkdownBody } from "./finance-markdown";
import classes from "./finance-ui.module.css";

export type ParsedSource = {
  title: string;
  url: string;
  filingDate?: string;
  provider?: string;
};

export type ParsedAssistantMessage = {
  bodyMarkdown: string;
  datePrecision?: string;
  sources: ParsedSource[];
};

const SOURCE_LINK_PATTERN =
  /^\s*-\s*\[([^\]]+)\]\(([^)]+)\)\s*(?:-\s*DART(?:\s*공시)?\s*)?\((\d{4}-\d{2}-\d{2})\)/i;

export function parseAssistantMessage(content: string): ParsedAssistantMessage {
  const datePrecisionMatch = content.match(/📅\s*날짜\s*정확도:\s*(.+?)(?:\n|$)/);
  const datePrecision = datePrecisionMatch?.[1]?.trim();

  let body = content;
  let sourcesBlock = "";

  const dividerIdx = body.search(/\n---\s*\n/);
  if (dividerIdx >= 0) {
    sourcesBlock = body.slice(dividerIdx);
    body = body.slice(0, dividerIdx);
  } else {
    const sourceHeader = body.search(/\n\*\*출처:\*\*/i);
    if (sourceHeader >= 0) {
      sourcesBlock = body.slice(sourceHeader);
      body = body.slice(0, sourceHeader);
    }
  }

  body = body.replace(/📅\s*날짜\s*정확도:.+?(?:\n|$)/, "").trim();

  const sources: ParsedSource[] = [];
  const sourceLines = sourcesBlock.split("\n");
  for (const line of sourceLines) {
    const mdMatch = line.match(SOURCE_LINK_PATTERN);
    if (mdMatch) {
      sources.push({
        title: mdMatch[1].trim(),
        url: mdMatch[2].trim(),
        filingDate: mdMatch[3],
        provider: "DART",
      });
      continue;
    }
    const inlineDate = line.match(/\((\d{4}-\d{2}-\d{2})\)/);
    const urlMatch = line.match(/\((https?:\/\/[^)]+)\)/);
    const titleMatch = line.match(/\[([^\]]+)\]/);
    if (urlMatch && titleMatch) {
      sources.push({
        title: titleMatch[1],
        url: urlMatch[1],
        filingDate: inlineDate?.[1],
        provider: line.includes("DART") ? "DART" : undefined,
      });
    }
  }

  return { bodyMarkdown: body.trim(), datePrecision, sources };
}

export function ChatMessageContent({ content }: { content: string }) {
  const parsed = parseAssistantMessage(content);

  return (
    <Stack gap="sm" data-testid="chat-message-content" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
      <FinanceMarkdownBody markdown={parsed.bodyMarkdown} />

      {parsed.datePrecision && (
        <Badge
          size="sm"
          variant="light"
          color="braun-red"
          leftSection={<IconCalendar size={12} />}
          data-testid="date-precision-badge"
        >
          날짜 정확도: {parsed.datePrecision}
        </Badge>
      )}

      {parsed.sources.length > 0 && (
        <Stack gap="xs" data-testid="source-citation-list">
          <Text size="xs" fw={600} c="dimmed">출처</Text>
          {parsed.sources.map((source, index) => (
            <Card
              key={`${source.url}-${index}`}
              withBorder={false}
              padding="sm"
              radius="sm"
              classNames={{ root: classes.surfaceCard }}
              data-testid={`source-citation-${index}`}
            >
              <Stack gap={4}>
                <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                  <Text size="sm" fw={500} style={{ flex: 1, minWidth: 0 }}>
                    {source.title}
                  </Text>
                  {source.provider && (
                    <Badge size="xs" variant="outline" color="gray">
                      {source.provider}
                    </Badge>
                  )}
                </Group>
                {source.filingDate && (
                  <Text size="xs" c="dimmed">공시일: {source.filingDate}</Text>
                )}
                <Anchor
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                  style={{ wordBreak: "break-all" }}
                >
                  <Group gap={4} wrap="nowrap">
                    <IconExternalLink size={12} />
                    <span>DART 공시 열기</span>
                  </Group>
                </Anchor>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
