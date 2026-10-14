"use client";

import { useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconLogout, IconPlus, IconRefresh, IconSettings } from "@tabler/icons-react";
import type { Bot } from "../store/finance-store";
import { useFinanceStore } from "../store/finance-store";
import { BotAvatar } from "./bot-avatar";
import { getBotDisplayMeta, getTemplateMeta, MAIN_BOT_ID } from "./bot-template-meta";
import { BotDetailModal } from "./bot-detail-modal";
import classes from "./finance-ui.module.css";

type FinanceBotSidebarProps = {
  onRefresh: () => void;
  onLogout: () => void;
  logoutPending: boolean;
  onBotSelected?: () => void;
  onCreateBot: () => void;
};

export function FinanceBotSidebar({
  onRefresh,
  onLogout,
  logoutPending,
  onBotSelected,
  onCreateBot,
}: FinanceBotSidebarProps) {
  const { bots, selectedBotId, selectBot } = useFinanceStore();
  const [settingsBot, setSettingsBot] = useState<Bot | null>(null);

  const activeId = selectedBotId || MAIN_BOT_ID;
  const mainMeta = getTemplateMeta("main");
  const specialists = bots.filter((b) => b.id !== MAIN_BOT_ID && b.template !== "main");

  function handleSelect(botId: string) {
    selectBot(botId);
    onBotSelected?.();
  }

  return (
    <>
      <Stack gap="sm" h="100%" p="md" data-testid="bot-sidebar" style={{ minHeight: 0 }}>
        <Button
          fullWidth
          leftSection={<IconPlus size={16} />}
          color="braun-red"
          size="sm"
          onClick={onCreateBot}
          data-testid="create-bot-btn"
        >
          새 Bot 만들기
        </Button>

        <Text size="xs" className={classes.sectionLabel} style={{ textTransform: "none", letterSpacing: 0 }}>
          봇
        </Text>

        <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
          <Stack gap={4}>
            <BotSidebarRow
              botId={MAIN_BOT_ID}
              name={mainMeta.label}
              roleLine={mainMeta.roleLine}
              active={activeId === MAIN_BOT_ID}
              onSelect={() => handleSelect(MAIN_BOT_ID)}
            />
            {specialists.map((bot) => {
              const display = getBotDisplayMeta(bot);
              return (
                <BotSidebarRow
                  key={bot.id}
                  botId={bot.id}
                  name={display.name}
                  roleLine={display.roleLine}
                  active={activeId === bot.id}
                  onSelect={() => handleSelect(bot.id)}
                  onSettings={() => setSettingsBot(bot)}
                  data-testid={`bot-sidebar-item-${bot.id}`}
                />
              );
            })}
          </Stack>
        </ScrollArea>

        <Divider />
        <Stack gap={4}>
          <Tooltip label="데이터 새로고침" withArrow>
            <UnstyledButton
              data-testid="nav-refresh"
              className={classes.botSidebarFooterAction}
              onClick={onRefresh}
            >
              <Group gap="xs">
                <IconRefresh size={16} />
                <Text size="sm">새로고침</Text>
              </Group>
            </UnstyledButton>
          </Tooltip>
          <UnstyledButton
            data-testid="nav-logout"
            className={classes.botSidebarFooterAction}
            onClick={onLogout}
            disabled={logoutPending}
          >
            <Group gap="xs">
              <IconLogout size={16} color="var(--mantine-color-red-6)" />
              <Text size="sm" c="red">로그아웃</Text>
            </Group>
          </UnstyledButton>
        </Stack>
      </Stack>

      <BotDetailModal bot={settingsBot} onClose={() => setSettingsBot(null)} onUpdated={onRefresh} />
    </>
  );
}

function BotSidebarRow({
  botId,
  name,
  roleLine,
  active,
  onSelect,
  onSettings,
  "data-testid": dataTestId,
}: {
  botId: string;
  name: string;
  roleLine: string;
  active: boolean;
  onSelect: () => void;
  onSettings?: () => void;
  "data-testid"?: string;
}) {
  const testId = dataTestId ?? `bot-sidebar-item-${botId}`;

  return (
    <Group gap={6} wrap="nowrap" align="stretch">
      <UnstyledButton
        data-testid={testId}
        onClick={onSelect}
        className={active ? classes.botSidebarItemActive : classes.botSidebarItem}
        style={{ flex: 1, minWidth: 0 }}
      >
        <Group gap="sm" wrap="nowrap" align="center">
          <BotAvatar botId={botId} size={36} />
          <Box style={{ minWidth: 0, textAlign: "left" }}>
            <Text size="sm" fw={active ? 500 : 400} truncate>{name}</Text>
            <Text size="xs" className={classes.muted} truncate>{roleLine}</Text>
          </Box>
        </Group>
      </UnstyledButton>
      {onSettings && (
        <ActionIcon
          variant="subtle"
          size="sm"
          aria-label="봇 설정"
          data-testid={`bot-sidebar-settings-${botId}`}
          onClick={(e) => {
            e.stopPropagation();
            onSettings();
          }}
        >
          <IconSettings size={14} />
        </ActionIcon>
      )}
    </Group>
  );
}
