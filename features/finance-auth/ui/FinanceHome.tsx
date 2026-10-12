"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  AppShell,
  Badge,
  Box,
  Burger,
  Divider,
  Group,
  Loader,
  NavLink,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  IconMessage,
  IconRobot,
  IconCalendarTime,
  IconActivity,
  IconLogout,
  IconRefresh,
} from "@tabler/icons-react";
import { useFinanceStore } from "../store/finance-store";
import { ChatPanel } from "./ChatPanel";
import { BotList } from "./BotList";
import { RoutineList } from "./RoutineList";
import { RunList } from "./RunList";
import { FINANCE_NAVBAR_TOP_PX, SITE_APP_SHELL_HEADER_HEIGHT_PX } from "@/shared/site-layout/constants";

export function FinanceHome() {
  const router = useRouter();
  const [opened, { toggle, close }] = useDisclosure();
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
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

  function refreshAll() {
    fetchBots();
    fetchRoutines();
    fetchRuns();
  }

  const navItems = [
    { icon: IconMessage, label: "채팅", tab: "chat" as const, badge: null },
    { icon: IconRobot, label: "봇", tab: "bots" as const, badge: bots.length > 0 ? bots.length : null },
    { icon: IconCalendarTime, label: "루틴", tab: "routines" as const, badge: null },
    { icon: IconActivity, label: "실행", tab: "runs" as const, badge: null },
  ];

  const activeLabel = navItems.find((item) => item.tab === activeTab)?.label ?? "금융";
  const financeViewportHeight = `calc(100dvh - ${SITE_APP_SHELL_HEADER_HEIGHT_PX}px)`;

  return (
    <AppShell
      data-testid="finance-app-shell"
      navbar={{ width: 220, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding={{ base: "xs", sm: "sm" }}
      style={{
        minHeight: financeViewportHeight,
        height: financeViewportHeight,
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
      }}
      styles={{
        root: {
          width: "100%",
          maxWidth: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        },
        navbar: {
          top: FINANCE_NAVBAR_TOP_PX,
          height: `calc(100dvh - ${FINANCE_NAVBAR_TOP_PX}px - var(--app-shell-footer-offset, 0rem))`,
          zIndex: 199,
        },
        main: {
          flex: "1 1 0",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          minHeight: 0,
          alignItems: "stretch",
          display: "flex",
          flexDirection: "column",
          paddingTop: 0,
          overflow: "hidden",
        },
      }}
    >
      <AppShell.Navbar p="md" data-testid="finance-navbar">
        <Stack gap="xs" h="100%" justify="space-between">
          <Stack gap="xs">
            {navItems.map((item) => (
              <NavLink
                key={item.tab}
                data-testid={`nav-${item.tab}`}
                label={item.label}
                leftSection={<item.icon size={18} />}
                rightSection={item.badge ? <Badge size="xs" variant="light">{item.badge}</Badge> : undefined}
                active={activeTab === item.tab}
                onClick={() => {
                  setActiveTab(item.tab);
                  if (isMobile) close();
                }}
                style={{ borderRadius: 8 }}
              />
            ))}
          </Stack>
          <Stack gap="xs">
            <Divider />
            <NavLink
              data-testid="nav-refresh"
              label="새로고침"
              leftSection={<IconRefresh size={18} />}
              onClick={() => {
                refreshAll();
                if (isMobile) close();
              }}
            />
            <NavLink
              data-testid="nav-logout"
              label="로그아웃"
              leftSection={<IconLogout size={18} />}
              c="red"
              disabled={logoutPending}
              onClick={() => {
                handleLogout();
                if (isMobile) close();
              }}
            />
          </Stack>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box
          hiddenFrom="sm"
          data-testid="finance-mobile-nav-bar"
          py={6}
          px="sm"
          style={{
            flexShrink: 0,
            borderBottom: "1px solid var(--app-shell-border-color, var(--mantine-color-gray-3))",
          }}
        >
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} size="sm" aria-label="금융 메뉴" data-testid="finance-nav-burger" />
            <Text size="sm" fw={500} truncate>
              {activeLabel}
            </Text>
          </Group>
        </Box>

        <Box
          w="100%"
          maw={1100}
          mx="auto"
          px={{ base: "sm", sm: "md" }}
          py={{ base: "xs", sm: "sm" }}
          style={{
            flex: 1,
            width: "100%",
            maxWidth: "min(1100px, 100%)",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            minWidth: 0,
            alignSelf: "stretch",
          }}
        >
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
            <Box component="div" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, width: "100%" }}>
              {activeTab === "chat" && <ChatPanel />}
              {activeTab === "bots" && <BotList onRefresh={fetchBots} />}
              {activeTab === "routines" && <RoutineList onRefresh={fetchRoutines} />}
              {activeTab === "runs" && <RunList onRefresh={fetchRuns} />}
            </Box>
          )}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
