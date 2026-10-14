"use client";

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Card,
  Collapse,
  Group,
  Progress,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconCoin,
  IconRepeat,
  IconAlertTriangle,
} from "@tabler/icons-react";
import type { AgentRun } from "../store/finance-store";
import { CollapsibleRunResultMarkdown } from "./finance-markdown";
import { RUN_ERROR_CODE_LABELS, RUN_STATUS_CONFIG } from "./run-list-config";
import classes from "./finance-ui.module.css";

export function RunCard({
  run,
  botName,
  routineName,
  onSelect,
}: {
  run: AgentRun;
  botName?: string;
  routineName?: string;
  onSelect: () => void;
}) {
  const [expanded, { toggle }] = useDisclosure(false);
  const status = RUN_STATUS_CONFIG[run.status] ?? {
    color: "gray",
    label: run.status || "알 수 없음",
    icon: RUN_STATUS_CONFIG.running.icon,
  };
  const StatusIcon = status.icon;
  const isActive = run.status === "running" || run.status === "queued";

  const durationMs =
    run.finishedAt && run.startedAt
      ? run.finishedAt - run.startedAt
      : run.startedAt
        ? Date.now() - run.startedAt
        : 0;

  return (
    <Card
      withBorder={false}
      padding="sm"
      classNames={{ root: `${classes.surfaceCard} ${classes.listRow}` }}
      data-testid={`run-card-${run.id}`}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, cursor: "pointer" }} onClick={onSelect}>
          <StatusIcon size={18} color={`var(--mantine-color-${status.color}-6)`} />
          <Box>
            <Group gap="xs">
              <Text fw={500} size="sm">{botName || run.botId}</Text>
              {routineName && (
                <Badge size="xs" variant="light">
                  {routineName}
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              {new Date(run.createdAt).toLocaleString("ko-KR")}
              {run.scheduledAt && ` · 예약: ${new Date(run.scheduledAt).toLocaleString("ko-KR")}`}
            </Text>
          </Box>
        </Group>
        <Group gap="xs">
          <Badge size="sm" color={status.color} data-testid={`run-status-${run.id}`}>
            {status.label}
          </Badge>
          {run.attempt > 1 && (
            <Tooltip label={`시도: ${run.attempt}/${run.maxAttempts}`}>
              <Badge
                size="xs"
                variant="light"
                color="gray"
                leftSection={<IconRepeat size={10} />}
                data-testid={`run-retry-${run.id}`}
              >
                {run.attempt}
              </Badge>
            </Tooltip>
          )}
          <ActionIcon variant="subtle" size="sm" onClick={toggle} data-testid={`run-expand-${run.id}`}>
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ActionIcon>
        </Group>
      </Group>

      {isActive && (
        <Progress
          value={100}
          animated
          mt="sm"
          size="xs"
          color={status.color}
          data-testid={`run-progress-${run.id}`}
        />
      )}

      <Collapse in={expanded}>
        <Box mt="sm" pt="sm" style={{ borderTop: "1px solid #ddd8d2" }}>
          <Stack gap="xs">
            {run.usage && (
              <Group gap="md">
                <Text size="xs" c="dimmed">
                  <IconClock size={12} style={{ verticalAlign: "middle" }} /> {(durationMs / 1000).toFixed(1)}초
                </Text>
                <Text size="xs" c="dimmed">
                  <IconCoin size={12} style={{ verticalAlign: "middle" }} /> ${run.usage.costUsd.toFixed(4)}
                </Text>
                <Text size="xs" c="dimmed">
                  {run.usage.steps}단계 · {run.usage.calls}호출
                </Text>
              </Group>
            )}
            {run.error && (
              <Alert color="red" p="xs" icon={<IconAlertTriangle size={14} />}>
                <Text size="xs">
                  {run.errorCode && RUN_ERROR_CODE_LABELS[run.errorCode]
                    ? `${RUN_ERROR_CODE_LABELS[run.errorCode]}: `
                    : ""}
                  {run.error}
                </Text>
              </Alert>
            )}
            {run.reportData?.response && (
              <CollapsibleRunResultMarkdown content={run.reportData.response} label="결과" />
            )}
            {run.reportData?.sources && run.reportData.sources.length > 0 && (
              <Group gap="xs">
                <Text size="xs" fw={500}>출처:</Text>
                {run.reportData.sources.map((source, i) => (
                  <Badge key={i} size="xs" variant="outline">
                    {source.title || source.reference}
                  </Badge>
                ))}
              </Group>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Card>
  );
}
