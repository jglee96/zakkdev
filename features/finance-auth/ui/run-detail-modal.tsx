"use client";

import {
  Alert,
  Badge,
  Box,
  Card,
  Group,
  Stack,
  Text,
} from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { AgentRun } from "../store/finance-store";
import { FinanceModal } from "./FinanceModal";
import { CollapsibleRunResultMarkdown } from "./finance-markdown";
import { RUN_ERROR_CODE_LABELS, RUN_STATUS_CONFIG } from "./run-list-config";
import classes from "./finance-ui.module.css";

export function RunDetailModal({
  run,
  onClose,
}: {
  run: AgentRun | null;
  onClose: () => void;
}) {
  if (!run) return null;

  const status = RUN_STATUS_CONFIG[run.status] ?? {
    color: "gray",
    label: run.status || "알 수 없음",
    icon: RUN_STATUS_CONFIG.running.icon,
  };
  const durationMs =
    run.finishedAt && run.startedAt
      ? run.finishedAt - run.startedAt
      : run.startedAt
        ? Date.now() - run.startedAt
        : 0;

  return (
    <FinanceModal opened={!!run} onClose={onClose} title="실행 상세" size="lg" data-testid="run-detail-modal">
      <Stack gap="md">
        <Group justify="space-between">
          <Badge size="lg" color={status.color}>{status.label}</Badge>
          {run.attempt > 1 && (
            <Badge variant="light" color="gray">
              시도 {run.attempt}/{run.maxAttempts}
            </Badge>
          )}
        </Group>

        <Box>
          <Text size="sm" fw={500}>실행 ID</Text>
          <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>{run.id}</Text>
        </Box>

        {run.routineId && (
          <Box>
            <Text size="sm" fw={500}>루틴 ID</Text>
            <Text size="xs" c="dimmed">{run.routineId} (v{run.routineVersion})</Text>
          </Box>
        )}

        <Group grow>
          <Box>
            <Text size="sm" fw={500}>시작</Text>
            <Text size="xs" c="dimmed">
              {run.startedAt ? new Date(run.startedAt).toLocaleString("ko-KR") : "-"}
            </Text>
          </Box>
          <Box>
            <Text size="sm" fw={500}>종료</Text>
            <Text size="xs" c="dimmed">
              {run.finishedAt ? new Date(run.finishedAt).toLocaleString("ko-KR") : "-"}
            </Text>
          </Box>
          <Box>
            <Text size="sm" fw={500}>소요 시간</Text>
            <Text size="xs" c="dimmed">{(durationMs / 1000).toFixed(1)}초</Text>
          </Box>
        </Group>

        {run.usage && (
          <Card withBorder={false} p="sm" classNames={{ root: classes.surfaceCard }}>
            <Text size="sm" fw={500} mb="xs">사용량</Text>
            <Group gap="md">
              <Box>
                <Text size="xs" c="dimmed">단계</Text>
                <Text fw={500}>{run.usage.steps}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">호출</Text>
                <Text fw={500}>{run.usage.calls}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">입력 토큰</Text>
                <Text fw={500}>{run.usage.inputTokens.toLocaleString()}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">출력 토큰</Text>
                <Text fw={500}>{run.usage.outputTokens.toLocaleString()}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">비용</Text>
                <Text fw={500}>${run.usage.costUsd.toFixed(4)}</Text>
              </Box>
            </Group>
          </Card>
        )}

        {run.error && (
          <Alert color="red" icon={<IconAlertTriangle size={16} />}>
            <Text size="sm" fw={500}>
              {run.errorCode && RUN_ERROR_CODE_LABELS[run.errorCode]
                ? RUN_ERROR_CODE_LABELS[run.errorCode]
                : "오류"}
            </Text>
            <Text size="xs">{run.error}</Text>
          </Alert>
        )}

        {run.reportData?.response && (
          <CollapsibleRunResultMarkdown content={run.reportData.response} label="결과" preview={false} />
        )}

        {run.reportData?.sources && run.reportData.sources.length > 0 && (
          <Box>
            <Text size="sm" fw={500}>출처</Text>
            <Stack gap="xs" mt="xs">
              {run.reportData.sources.map((source, i) => (
                <Card key={i} withBorder p="xs">
                  <Group gap="xs">
                    <Badge size="xs">{source.type}</Badge>
                    <Text size="xs">{source.title || source.reference}</Text>
                  </Group>
                </Card>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </FinanceModal>
  );
}
