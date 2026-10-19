"use client";

import { useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconActivity, IconRefresh } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { useFinanceStore, type AgentRun } from "../store/finance-store";
import { RunDetailModal } from "./finance-dynamic-modals";
import { FinanceSectionTitle } from "./finance-section-title";
import { RunCard } from "./run-card";
import classes from "./finance-ui.module.css";

export function RunList({
  onRefresh,
  botIdFilter,
}: {
  onRefresh: () => void;
  botIdFilter?: string;
}) {
  const { runs, bots, routines, isLoadingRuns, runsError } = useFinanceStore(
    useShallow((s) => ({
      runs: s.runs,
      bots: s.bots,
      routines: s.routines,
      isLoadingRuns: s.isLoadingRuns,
      runsError: s.runsError,
    })),
  );
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);

  const visibleRuns = botIdFilter ? runs.filter((r) => r.botId === botIdFilter) : runs;
  const runningCount = visibleRuns.filter((r) => r.status === "running" || r.status === "queued").length;
  const botNameById = useMemo(() => new Map(bots.map((b) => [b.id, b.name])), [bots]);
  const routineNameById = useMemo(() => new Map(routines.map((r) => [r.id, r.name])), [routines]);

  return (
    <Stack gap="md" w="100%" data-testid="run-list-container">
      <Group justify="space-between">
        <Group gap="xs">
          <FinanceSectionTitle>실행 기록</FinanceSectionTitle>
          {runningCount > 0 && (
            <Badge color="cyan" variant="light" data-testid="running-count-badge">
              {runningCount}개 실행중
            </Badge>
          )}
        </Group>
        <Tooltip label="새로고침">
          <ActionIcon variant="subtle" onClick={onRefresh} data-testid="refresh-runs">
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {runsError && <Alert color="red" data-testid="runs-error">{runsError}</Alert>}

      {isLoadingRuns && visibleRuns.length === 0 ? (
        <Box ta="center" py="xl" data-testid="runs-loading"><Loader /></Box>
      ) : visibleRuns.length === 0 ? (
        <Card withBorder={false} p="xl" ta="center" classNames={{ root: classes.surfaceCard }} data-testid="runs-empty">
          <IconActivity size={48} color="gray" style={{ margin: "0 auto", marginBottom: 16 }} />
          <Text c="dimmed">아직 실행 기록이 없습니다.</Text>
          <Text size="sm" c="dimmed" mt="xs">
            채팅이나 루틴을 통해 봇을 실행하면 여기에 기록됩니다.
          </Text>
        </Card>
      ) : (
        <Stack gap="sm" data-testid="runs-list">
          {visibleRuns.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              botName={botNameById.get(run.botId)}
              routineName={run.routineId ? routineNameById.get(run.routineId) : undefined}
              onSelect={() => setSelectedRun(run)}
            />
          ))}
        </Stack>
      )}

      <RunDetailModal run={selectedRun} onClose={() => setSelectedRun(null)} />
    </Stack>
  );
}
