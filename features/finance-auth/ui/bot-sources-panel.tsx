"use client";

import { useMemo } from "react";
import { Anchor, Card, Group, Stack, Text } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { useFinanceStore } from "../store/finance-store";
import { MAIN_BOT_ID } from "./bot-template-meta";
import { parseAssistantMessage, type ParsedSource } from "./chat-message-content";
import { FinanceSectionTitle } from "./finance-section-title";
import classes from "./finance-ui.module.css";

export function BotSourcesPanel() {
  const { messages, selectedBotId } = useFinanceStore(
    useShallow((s) => ({ messages: s.messages, selectedBotId: s.selectedBotId })),
  );
  const botId = selectedBotId || MAIN_BOT_ID;

  const sources = useMemo(() => {
    const map = new Map<string, ParsedSource & { messageId: string }>();
    for (const message of messages) {
      if (message.botId !== botId || message.role !== "assistant" || !message.content) continue;
      const parsed = parseAssistantMessage(message.content);
      for (const source of parsed.sources) {
        const key = source.url || source.title;
        if (!map.has(key)) map.set(key, { ...source, messageId: message.id });
      }
    }
    return Array.from(map.values());
  }, [messages, botId]);

  return (
    <Stack gap="md" w="100%" data-testid="bot-sources-panel">
      <FinanceSectionTitle>출처</FinanceSectionTitle>
      <Text size="sm" className={classes.muted}>
        이 봇 대화에서 인용된 DART·링크 출처를 모아 보여줍니다.
      </Text>
      {sources.length === 0 ? (
        <Card withBorder={false} p="lg" classNames={{ root: classes.surfaceCard }} data-testid="bot-sources-empty">
          <Text size="sm" className={classes.muted} ta="center">
            아직 저장된 출처가 없습니다. 채팅에서 공시 분석을 요청해 보세요.
          </Text>
        </Card>
      ) : (
        <Stack gap="sm" data-testid="bot-sources-list">
          {sources.map((source, index) => (
            <Card
              key={`${source.url}-${index}`}
              withBorder={false}
              padding="sm"
              classNames={{ root: classes.surfaceCard }}
              data-testid={`bot-source-item-${index}`}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                  <Text size="sm" fw={500}>{source.title}</Text>
                  {source.filingDate && (
                    <Text size="xs" className={classes.muted}>공시일: {source.filingDate}</Text>
                  )}
                  <Anchor href={source.url} target="_blank" rel="noopener noreferrer" size="xs">
                    <Group gap={4} wrap="nowrap">
                      <IconExternalLink size={12} />
                      <span style={{ wordBreak: "break-all" }}>{source.url}</span>
                    </Group>
                  </Anchor>
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
