"use client";

import { Anchor, Badge, Card, Group, Stack, Text } from "@mantine/core";
import { IconCalendar, IconExternalLink } from "@tabler/icons-react";
import type { ChatBlock, ChatSource } from "@/shared/finance/chat/types";
import { FinanceMarkdownBody } from "./finance-markdown";
import classes from "./finance-ui.module.css";

function sourceById(sources: ChatSource[], id: string) {
  return sources.find((s) => s.id === id);
}

function formatFilingDate(source: ChatSource) {
  if (!source.filingDate) return null;
  if (source.timePrecision === "datetime") {
    return `공시 시각: ${source.filingDate}`;
  }
  return `공시일: ${source.filingDate}`;
}

export function DisclosureCard({
  block,
  sources,
}: {
  block: Extract<ChatBlock, { type: "disclosure" }>;
  sources: ChatSource[];
}) {
  const source = sourceById(sources, block.sourceId);
  if (!source) return null;
  const dateLabel = formatFilingDate(source);
  return (
    <Card
      withBorder={false}
      padding="sm"
      classNames={{ root: classes.surfaceCard }}
      data-testid="disclosure-card"
    >
      <Stack gap={6}>
        <Group justify="space-between" gap="xs" wrap="wrap">
          <Text size="sm" fw={600}>{block.headline || source.title}</Text>
          <Badge size="xs" variant="outline">{source.provider.toUpperCase()}</Badge>
        </Group>
        {block.summaryMarkdown && <FinanceMarkdownBody markdown={block.summaryMarkdown} />}
        {dateLabel && (
          <Text size="xs" className={classes.muted} data-testid="disclosure-filing-date">
            {dateLabel}
          </Text>
        )}
        <Text size="xs" className={classes.muted}>
          최초 수집: {new Date(source.firstSeenAt).toLocaleString("ko-KR")}
        </Text>
        <Anchor href={source.url} target="_blank" rel="noopener noreferrer" size="xs">
          <Group gap={4} wrap="nowrap">
            <IconExternalLink size={12} />
            {source.receiptNo ? `접수번호 ${source.receiptNo}` : "원문 보기"}
          </Group>
        </Anchor>
      </Stack>
    </Card>
  );
}

export function ThesisCard({
  block,
  sources,
}: {
  block: Extract<ChatBlock, { type: "thesis" }>;
  sources: ChatSource[];
}) {
  const stanceLabel =
    block.stance === "supports" ? "지지" : block.stance === "refutes" ? "반박" : "중립";
  const stanceColor =
    block.stance === "supports" ? "green" : block.stance === "refutes" ? "red" : "gray";

  return (
    <Card
      withBorder={false}
      padding="sm"
      classNames={{ root: classes.surfaceCard }}
      data-testid="thesis-card"
    >
      <Stack gap="xs">
        <Group gap="xs">
          <Badge color={stanceColor} variant="light">{stanceLabel}</Badge>
          <Text size="sm" fw={600}>가설</Text>
        </Group>
        <Text size="sm">{block.claim}</Text>
        {block.evidenceSourceIds.length > 0 && (
          <Stack gap={4} data-testid="thesis-evidence-links">
            <Text size="xs" fw={600} className={classes.muted}>증거 출처</Text>
            {block.evidenceSourceIds.map((id) => {
              const source = sourceById(sources, id);
              if (!source) return null;
              return (
                <Anchor key={id} href={source.url} target="_blank" rel="noopener noreferrer" size="xs">
                  {source.title}
                </Anchor>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

export function FinancialsCard({
  block,
  sources,
}: {
  block: Extract<ChatBlock, { type: "financials" }>;
  sources: ChatSource[];
}) {
  const source = block.sourceId ? sourceById(sources, block.sourceId) : undefined;
  return (
    <Card
      withBorder={false}
      padding="sm"
      classNames={{ root: classes.surfaceCard }}
      data-testid="financials-card"
    >
      <Stack gap="xs">
        <Text size="sm" fw={600}>재무 요약</Text>
        <FinanceMarkdownBody markdown={block.metricsMarkdown} />
        {source && (
          <Anchor href={source.url} target="_blank" rel="noopener noreferrer" size="xs">
            {source.title}
          </Anchor>
        )}
      </Stack>
    </Card>
  );
}

export function StructuredMessageBody({
  bodyMarkdown,
  blocks,
  sources,
  datePrecision,
  structuredFallback,
}: {
  bodyMarkdown: string;
  blocks?: ChatBlock[];
  sources?: ChatSource[];
  datePrecision?: string;
  structuredFallback?: boolean;
}) {
  const resolvedSources = sources ?? [];
  const resolvedBlocks = blocks ?? [];

  return (
    <Stack gap="sm" data-testid="structured-message-body" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
      {bodyMarkdown && <FinanceMarkdownBody markdown={bodyMarkdown} />}

      {datePrecision && (
        <Badge
          size="sm"
          variant="light"
          color="braun-red"
          leftSection={<IconCalendar size={12} />}
          data-testid="date-precision-badge"
        >
          날짜 정확도: {datePrecision}
        </Badge>
      )}

      {structuredFallback && resolvedBlocks.length === 0 && (
        <Text size="xs" className={classes.muted} data-testid="structured-fallback-hint">
          구조화 카드 없이 마크다운으로 표시됩니다.
        </Text>
      )}

      {resolvedBlocks.map((block, index) => {
        switch (block.type) {
          case "disclosure":
            return <DisclosureCard key={`${block.type}-${index}`} block={block} sources={resolvedSources} />;
          case "thesis":
            return <ThesisCard key={`${block.type}-${index}`} block={block} sources={resolvedSources} />;
          case "financials":
            return <FinancialsCard key={`${block.type}-${index}`} block={block} sources={resolvedSources} />;
          case "markdown":
            return (
              <Card key={`${block.type}-${index}`} withBorder={false} padding="sm" classNames={{ root: classes.surfaceCard }}>
                <FinanceMarkdownBody markdown={block.content} />
              </Card>
            );
          default: {
            const _exhaustive: never = block;
            return _exhaustive;
          }
        }
      })}
    </Stack>
  );
}
