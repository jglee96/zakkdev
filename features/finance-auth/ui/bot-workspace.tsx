"use client";

import { Tabs } from "@mantine/core";
import { useFinanceStore, type BotWorkspaceTab } from "../store/finance-store";
import { ChatPanel } from "./ChatPanel";
import { RoutineList } from "./RoutineList";
import { RunList } from "./RunList";
import { BotSourcesPanel } from "./bot-sources-panel";
import { MAIN_BOT_ID } from "./bot-template-meta";

const TAB_ITEMS: { value: BotWorkspaceTab; label: string; legacyTestId: string }[] = [
  { value: "chat", label: "채팅", legacyTestId: "nav-chat" },
  { value: "runs", label: "실행", legacyTestId: "nav-runs" },
  { value: "routines", label: "루틴", legacyTestId: "nav-routines" },
  { value: "sources", label: "출처", legacyTestId: "nav-sources" },
];

export function BotWorkspace({
  onRefreshBots,
  onRefreshRoutines,
  onRefreshRuns,
  onOpenCreateBot,
}: {
  onRefreshBots: () => void;
  onRefreshRoutines: () => void;
  onRefreshRuns: () => void;
  onOpenCreateBot: () => void;
}) {
  const { botWorkspaceTab, setBotWorkspaceTab, selectedBotId } = useFinanceStore();
  const botId = selectedBotId || MAIN_BOT_ID;

  return (
    <Tabs
      value={botWorkspaceTab}
      onChange={(v) => v && setBotWorkspaceTab(v as BotWorkspaceTab)}
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}
      data-testid="bot-workspace"
    >
      <Tabs.List style={{ flexShrink: 0 }} grow>
        {TAB_ITEMS.map((tab) => (
          <Tabs.Tab
            key={tab.value}
            value={tab.value}
            data-testid={`bot-workspace-tab-${tab.value}`}
            id={tab.legacyTestId}
            aria-controls={tab.legacyTestId}
          >
            <span data-testid={tab.legacyTestId}>{tab.label}</span>
          </Tabs.Tab>
        ))}
      </Tabs.List>

      <Tabs.Panel value="chat" pt="sm" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <ChatPanel onOpenCreateBot={onOpenCreateBot} />
      </Tabs.Panel>
      <Tabs.Panel value="runs" pt="sm" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <RunList onRefresh={onRefreshRuns} botIdFilter={botId} />
      </Tabs.Panel>
      <Tabs.Panel value="routines" pt="sm" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <RoutineList onRefresh={onRefreshRoutines} botIdFilter={botId} />
      </Tabs.Panel>
      <Tabs.Panel value="sources" pt="sm" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <BotSourcesPanel />
      </Tabs.Panel>
    </Tabs>
  );
}
