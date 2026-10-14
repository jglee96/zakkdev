"use client";

import { useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCalendarTime, IconPlus, IconRefresh } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { useFinanceStore, type Routine } from "../store/finance-store";
import { CreateRoutineModal, RoutineDetailModal } from "./finance-dynamic-modals";
import { FinanceSectionTitle } from "./finance-section-title";
import { RoutineCard } from "./routine-card";
import classes from "./finance-ui.module.css";

export function RoutineList({
  onRefresh,
  botIdFilter,
}: {
  onRefresh: () => void;
  botIdFilter?: string;
}) {
  const { routines, bots, isLoadingRoutines, routinesError } = useFinanceStore(
    useShallow((s) => ({
      routines: s.routines,
      bots: s.bots,
      isLoadingRoutines: s.isLoadingRoutines,
      routinesError: s.routinesError,
    })),
  );
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);

  const activeRoutines = routines
    .filter((r) => r.status !== "deleted")
    .filter((r) => (botIdFilter ? r.botId === botIdFilter : true));
  const botNameById = useMemo(() => new Map(bots.map((b) => [b.id, b.name])), [bots]);

  return (
    <Stack gap="md" w="100%" data-testid="routine-list-container">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" w="100%" style={{ minWidth: 0 }}>
        <FinanceSectionTitle>정기 실행 (루틴)</FinanceSectionTitle>
        <Group gap="xs" style={{ flexShrink: 0 }}>
          <Tooltip label="새로고침">
            <ActionIcon variant="subtle" onClick={onRefresh} data-testid="refresh-routines">
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            onClick={openCreate}
            data-testid="create-routine-btn"
          >
            루틴 생성
          </Button>
        </Group>
      </Group>

      {routinesError && <Alert color="red" data-testid="routines-error">{routinesError}</Alert>}

      {isLoadingRoutines ? (
        <Box ta="center" py="xl" data-testid="routines-loading"><Loader /></Box>
      ) : activeRoutines.length === 0 ? (
        <Card withBorder={false} p="xl" ta="center" classNames={{ root: classes.surfaceCard }} data-testid="routines-empty">
          <IconCalendarTime size={48} color="gray" style={{ margin: "0 auto", marginBottom: 16 }} />
          <Text c="dimmed">아직 생성된 루틴이 없습니다.</Text>
          <Text size="sm" c="dimmed" mt="xs">
            정기적으로 봇을 실행하려면 루틴을 생성하세요.
          </Text>
          <Button mt="md" onClick={openCreate}>첫 루틴 만들기</Button>
        </Card>
      ) : (
        <Stack gap="sm" data-testid="routines-list">
          {activeRoutines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              botName={botNameById.get(routine.botId)}
              onSelect={() => setSelectedRoutine(routine)}
              onRefresh={onRefresh}
            />
          ))}
        </Stack>
      )}

      <CreateRoutineModal opened={createOpened} onClose={closeCreate} onCreated={onRefresh} />
      <RoutineDetailModal
        routine={selectedRoutine}
        onClose={() => setSelectedRoutine(null)}
        onUpdated={onRefresh}
      />
    </Stack>
  );
}
