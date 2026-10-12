"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Box,
  Burger,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  IconMessage,
  IconRobot,
  IconCalendarTime,
  IconActivity,
  IconLogout,
  IconMoon,
  IconSun,
  IconDotsVertical,
  IconRefresh,
} from "@tabler/icons-react";
import { useFinanceStore } from "../store/finance-store";
import { ChatPanel } from "./ChatPanel";
import { BotList } from "./BotList";
import { RoutineList } from "./RoutineList";
import { RunList } from "./RunList";

export function FinanceHome() {
  const router = useRouter();
  const [opened, { toggle, close }] = useDisclosure();
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const {
    activeTab,
    setActiveTab,
    bots,
    setBots,
    setRoutines,
    setRuns,
    isLoadingBots,
    setIsLoadingBots,
    setBotsError,
    setRoutinesError,
    setRunsError,
    reset,
  } = useFinanceStore();

  const fetchBots = useCallback(async () => {
    setIsLoadingBots(true);
    setBotsError(null);
    try {
      const response = await fetch("/api/finance/bots", { credentials: "same-origin" });
      if (!response.ok) throw new Error("봇 목록 조회 실패");
      const data = await response.json();
      setBots(data.bots);
    } catch (error) {
      setBotsError(error instanceof Error ? error.message : "알 수 없는 오류");
    } finally {
      setIsLoadingBots(false);
    }
  }, [setBots, setIsLoadingBots, setBotsError]);

  const fetchRoutines = useCallback(async () => {
    setRoutinesError(null);
    try {
      const response = await fetch("/api/finance/routines", { credentials: "same-origin" });
      if (!response.ok) throw new Error("루틴 목록 조회 실패");
      const data = await response.json();
      setRoutines(data.routines);
    } catch (error) {
      setRoutinesError(error instanceof Error ? error.message : "알 수 없는 오류");
    }
  }, [setRoutines, setRoutinesError]);

  const fetchRuns = useCallback(async () => {
    setRunsError(null);
    try {
      const response = await fetch("/api/finance/runs?limit=50", { credentials: "same-origin" });
      if (!response.ok) throw new Error("실행 목록 조회 실패");
      const data = await response.json();
      setRuns(data.runs);
    } catch (error) {
      setRunsError(error instanceof Error ? error.message : "알 수 없는 오류");
    }
  }, [setRuns, setRunsError]);

  useEffect(() => {
    fetchBots();
    fetchRoutines();
    fetchRuns();
  }, [fetchBots, fetchRoutines, fetchRuns]);

  useEffect(() => {
    if (activeTab === "runs") {
      const interval = setInterval(fetchRuns, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchRuns]);

  async function handleLogout() {
    setLogoutPending(true);
    setLogoutError(null);
    try {
      const response = await fetch("/api/finance/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok && response.status !== 401) throw new Error("로그아웃 실패");
      reset();
      router.replace("/finance/login");
      router.refresh();
    } catch {
      setLogoutError("로그아웃에 실패했습니다.");
    } finally {
      setLogoutPending(false);
    }
  }

  const navItems = [
    { icon: IconMessage, label: "채팅", tab: "chat" as const, badge: null },
    { icon: IconRobot, label: "봇", tab: "bots" as const, badge: bots.length > 0 ? bots.length : null },
    { icon: IconCalendarTime, label: "루틴", tab: "routines" as const, badge: null },
    { icon: IconActivity, label: "실행", tab: "runs" as const, badge: null },
  ];

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 220, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3} size="h4">금융 리서치</Title>
          </Group>
          <Group gap="xs">
            <Tooltip label={colorScheme === "dark" ? "라이트 모드" : "다크 모드"}>
              <ActionIcon variant="subtle" onClick={() => toggleColorScheme()}>
                {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Tooltip>
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="subtle">
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconRefresh size={14} />}
                  onClick={() => {
                    fetchBots();
                    fetchRoutines();
                    fetchRuns();
                  }}
                >
                  새로고침
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconLogout size={14} />}
                  onClick={handleLogout}
                  disabled={logoutPending}
                  c="red"
                >
                  로그아웃
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" data-testid="finance-navbar">
        <Stack gap="xs">
          {navItems.map((item) => (
            <NavLink
              key={item.tab}
              data-testid={`nav-${item.tab}`}
              label={item.label}
              leftSection={<item.icon size={18} />}
              rightSection={item.badge && <Badge size="xs" variant="light">{item.badge}</Badge>}
              active={activeTab === item.tab}
              onClick={() => {
                setActiveTab(item.tab);
                if (isMobile) close();
              }}
              style={{ borderRadius: 8 }}
            />
          ))}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        {logoutError && (
          <Alert color="red" mb="md" withCloseButton onClose={() => setLogoutError(null)}>
            {logoutError}
          </Alert>
        )}

        {isLoadingBots && activeTab === "chat" ? (
          <Box ta="center" py="xl">
            <Loader size="lg" />
            <Text c="dimmed" mt="md">로딩 중...</Text>
          </Box>
        ) : (
          <>
            {activeTab === "chat" && <ChatPanel />}
            {activeTab === "bots" && <BotList onRefresh={fetchBots} />}
            {activeTab === "routines" && <RoutineList onRefresh={fetchRoutines} />}
            {activeTab === "runs" && <RunList onRefresh={fetchRuns} />}
          </>
        )}
      </AppShell.Main>
    </AppShell>
  );
}
