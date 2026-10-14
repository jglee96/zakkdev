"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  AppShell,
  Box,
  Group,
  Loader,
  Portal,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { IconChevronDown } from "@tabler/icons-react";
import { useFinanceStore } from "../store/finance-store";
import { BotWorkspace } from "./bot-workspace";
import { FinanceBotSidebar } from "./finance-bot-sidebar";
import { CreateBotModal } from "./create-bot-modal";
import { FINANCE_NAVBAR_TOP_PX, SITE_APP_SHELL_HEADER_HEIGHT_PX } from "@/shared/site-layout/constants";
import { MODAL_ROOT_SELECTOR } from "@/shared/site-layout/modal-root";
import { getBotDisplayMeta, MAIN_BOT_ID } from "./bot-template-meta";
import classes from "./finance-ui.module.css";

export function FinanceHome() {
  const router = useRouter();
  const [drawerOpen, { toggle, close }] = useDisclosure();
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [createBotOpen, setCreateBotOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const {
    botWorkspaceTab,
    selectedBotId,
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

  const activeBotId = selectedBotId || MAIN_BOT_ID;
  const activeBot =
    activeBotId === MAIN_BOT_ID
      ? { id: MAIN_BOT_ID, name: "메인 봇", template: "main" as const }
      : bots.find((b) => b.id === activeBotId);
  const activeDisplay = activeBot
    ? getBotDisplayMeta(activeBot as { id: string; name: string; template: "main" | import("../store/finance-store").BotTemplate })
    : getBotDisplayMeta({ id: MAIN_BOT_ID, name: "메인 봇", template: "kr-stock" });

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
    if (botWorkspaceTab === "runs") {
      const interval = setInterval(fetchRuns, 5000);
      return () => clearInterval(interval);
    }
  }, [botWorkspaceTab, fetchRuns]);

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

  const financeViewportHeight = `calc(100dvh - ${SITE_APP_SHELL_HEADER_HEIGHT_PX}px)`;
  const sidebarWidth = 280;

  const sidebar = (
    <FinanceBotSidebar
      onRefresh={refreshAll}
      onLogout={handleLogout}
      logoutPending={logoutPending}
      onBotSelected={isMobile ? close : undefined}
      onCreateBot={() => setCreateBotOpen(true)}
    />
  );

  return (
    <AppShell
      data-testid="finance-app-shell"
      navbar={{ width: sidebarWidth, breakpoint: "sm", collapsed: { mobile: true, desktop: false } }}
      padding={0}
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
          padding: 0,
          overflow: "hidden",
        },
      }}
    >
      {isMobile && drawerOpen && (
        <Portal target={MODAL_ROOT_SELECTOR}>
          <Box
            data-testid="finance-mobile-nav-overlay"
            onClick={close}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              backgroundColor: "var(--mantine-color-gray-filled)",
              opacity: 0.45,
            }}
          />
          <Box
            data-testid="finance-mobile-nav-drawer"
            style={{
              position: "fixed",
              left: 0,
              top: FINANCE_NAVBAR_TOP_PX,
              width: sidebarWidth,
              bottom: 0,
              zIndex: 201,
              backgroundColor: "var(--mantine-color-body)",
              borderRight: "1px solid #ddd8d2",
              boxSizing: "border-box",
            }}
          >
            {sidebar}
          </Box>
        </Portal>
      )}

      <AppShell.Navbar visibleFrom="sm" p={0} className={classes.navShell} data-testid="finance-navbar">
        {sidebar}
      </AppShell.Navbar>

      <AppShell.Main
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          flex: 1,
          overflow: "hidden",
        }}
      >
        <Box
          hiddenFrom="sm"
          data-testid="finance-mobile-nav-bar"
          className={classes.mobileNavBar}
          py={6}
          px="sm"
          style={{ flexShrink: 0 }}
        >
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <UnstyledButton
              data-testid="finance-nav-burger"
              onClick={toggle}
              style={{ flex: 1, minWidth: 0 }}
            >
              <Group gap={6} wrap="nowrap">
                <Text size="sm" fw={500} truncate>{activeDisplay.name}</Text>
                <Text size="xs" className={classes.muted} truncate>{activeDisplay.roleLine}</Text>
                <IconChevronDown size={14} />
              </Group>
            </UnstyledButton>
          </Group>
        </Box>

        <Box
          className={classes.workspaceMain}
          data-testid="finance-workspace-main"
          w="100%"
          style={{
            flex: 1,
            width: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {logoutError && (
            <Alert color="red" m="sm" withCloseButton onClose={() => setLogoutError(null)}>
              {logoutError}
            </Alert>
          )}

          {isLoadingBots ? (
            <Box ta="center" py="xl">
              <Loader size="lg" />
              <Text c="dimmed" mt="md">로딩 중...</Text>
            </Box>
          ) : (
            <BotWorkspace
              onRefreshBots={fetchBots}
              onRefreshRoutines={fetchRoutines}
              onRefreshRuns={fetchRuns}
              onOpenCreateBot={() => setCreateBotOpen(true)}
            />
          )}
        </Box>
      </AppShell.Main>

      <CreateBotModal
        opened={createBotOpen}
        onClose={() => setCreateBotOpen(false)}
        onCreated={() => {
          fetchBots();
          setCreateBotOpen(false);
        }}
      />
    </AppShell>
  );
}
