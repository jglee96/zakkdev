"use client";

import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Group,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconCalendarTime,
  IconEdit,
  IconPlayerPause,
  IconPlayerPlay,
} from "@tabler/icons-react";
import type { Routine, RoutineStatus } from "../store/finance-store";
import { formatCronSchedule } from "./routine-schedule";
import classes from "./finance-ui.module.css";

const STATUS_BADGE: Record<RoutineStatus, { color: string; label: string }> = {
  pending: { color: "yellow", label: "대기" },
  active: { color: "green", label: "활성" },
  paused: { color: "gray", label: "일시정지" },
  deleted: { color: "red", label: "삭제됨" },
};

export function RoutineCard({
  routine,
  botName,
  onSelect,
  onRefresh,
}: {
  routine: Routine;
  botName?: string;
  onSelect: () => void;
  onRefresh: () => void;
}) {
  const status = STATUS_BADGE[routine.status] ?? { color: "gray", label: routine.status || "알 수 없음" };
  const [isToggling, setIsToggling] = useState(false);

  async function toggleStatus() {
    setIsToggling(true);
    try {
      const newStatus = routine.status === "active" ? "paused" : "active";
      const response = await fetch(`/api/finance/routines/${routine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
        credentials: "same-origin",
      });
      if (response.ok) onRefresh();
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <Card
      withBorder={false}
      padding="sm"
      classNames={{ root: `${classes.surfaceCard} ${classes.listRow}` }}
      data-testid={`routine-card-${routine.name}`}
    >
      <Group justify="space-between" wrap="nowrap">
        <Box style={{ cursor: "pointer", flex: 1 }} onClick={onSelect}>
          <Group gap="sm" wrap="nowrap">
            <IconCalendarTime size={20} />
            <Box>
              <Text fw={500}>{routine.name}</Text>
              <Text size="xs" c="dimmed">
                {botName || routine.botId} · {formatCronSchedule(routine.cronExpr, routine.timezone)}
              </Text>
            </Box>
          </Group>
        </Box>
        <Group gap="xs">
          <Badge size="sm" color={status.color} data-testid={`routine-status-${routine.id}`}>
            {status.label}
          </Badge>
          {routine.status !== "deleted" && (
            <Tooltip label={routine.status === "active" ? "일시정지" : "활성화"}>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={toggleStatus}
                loading={isToggling}
                data-testid={`routine-toggle-${routine.id}`}
              >
                {routine.status === "active" ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="편집">
            <ActionIcon variant="subtle" size="sm" onClick={onSelect} data-testid={`routine-edit-${routine.id}`}>
              <IconEdit size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  );
}
