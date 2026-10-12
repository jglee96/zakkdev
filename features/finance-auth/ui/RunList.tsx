"use client";

import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Card,
  Collapse,
  Group,
  Loader,
  Modal,
  Progress,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconActivity,
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconCoin,
  IconPlayerPause,
  IconRefresh,
  IconRepeat,
  IconX,
} from "@tabler/icons-react";
import { useFinanceStore, type AgentRun, type RunStatus } from "../store/finance-store";

const STATUS_CONFIG: Record<RunStatus, { color: string; label: string; icon: typeof IconCheck }> = {
  queued: { color: "blue", label: "대기중", icon: IconClock },
  running: { color: "cyan", label: "실행중", icon: IconActivity },
  completed: { color: "green", label: "완료", icon: IconCheck },
  failed: { color: "red", label: "실패", icon: IconX },
  canceled: { color: "gray", label: "취소됨", icon: IconPlayerPause },
  timeout: { color: "orange", label: "시간초과", icon: IconAlertTriangle },
};

const ERROR_CODE_LABELS: Record<string, string> = {
  MAX_ATTEMPTS: "최대 시도 횟수 초과",
  BUDGET_EXCEEDED: "예산 초과",
  BOT_NOT_FOUND: "봇 없음",
  BOT_INACTIVE: "봇 비활성",
  TIMEOUT: "시간 초과",
};

export function RunList({ onRefresh }: { onRefresh: () => void }) {
  const { runs, bots, routines, isLoadingRuns, runsError } = useFinanceStore();
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);

  const runningCount = runs.filter((r) => r.status === "running" || r.status === "queued").length;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={4}>실행 기록</Title>
          {runningCount > 0 && (
            <Badge color="cyan" variant="light">
              {runningCount}개 실행중
            </Badge>
          )}
        </Group>
        <Tooltip label="새로고침">
          <ActionIcon variant="subtle" onClick={onRefresh}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {runsError && <Alert color="red">{runsError}</Alert>}

      {isLoadingRuns && runs.length === 0 ? (
        <Box ta="center" py="xl"><Loader /></Box>
      ) : runs.length === 0 ? (
        <Card withBorder p="xl" ta="center">
          <IconActivity size={48} color="gray" style={{ margin: "0 auto", marginBottom: 16 }} />
          <Text c="dimmed">아직 실행 기록이 없습니다.</Text>
          <Text size="sm" c="dimmed" mt="xs">
            채팅이나 루틴을 통해 봇을 실행하면 여기에 기록됩니다.
          </Text>
        </Card>
      ) : (
        <Stack gap="sm">
          {runs.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              botName={bots.find((b) => b.id === run.botId)?.name}
              routineName={routines.find((r) => r.id === run.routineId)?.name}
              onSelect={() => setSelectedRun(run)}
            />
          ))}
        </Stack>
      )}

      <RunDetailModal run={selectedRun} onClose={() => setSelectedRun(null)} />
    </Stack>
  );
}

function RunCard({
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
  const status = STATUS_CONFIG[run.status];
  const StatusIcon = status.icon;
  const isActive = run.status === "running" || run.status === "queued";

  const durationMs = run.finishedAt && run.startedAt
    ? run.finishedAt - run.startedAt
    : run.startedAt
    ? Date.now() - run.startedAt
    : 0;

  return (
    <Card withBorder padding="sm">
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
          <Badge size="sm" color={status.color}>
            {status.label}
          </Badge>
          {run.attempt > 1 && (
            <Tooltip label={`시도: ${run.attempt}/${run.maxAttempts}`}>
              <Badge size="xs" variant="light" color="gray" leftSection={<IconRepeat size={10} />}>
                {run.attempt}
              </Badge>
            </Tooltip>
          )}
          <ActionIcon variant="subtle" size="sm" onClick={toggle}>
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ActionIcon>
        </Group>
      </Group>

      {isActive && (
        <Progress value={100} animated mt="sm" size="xs" color={status.color} />
      )}

      <Collapse in={expanded}>
        <Box mt="sm" pt="sm" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
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
                  {run.errorCode && ERROR_CODE_LABELS[run.errorCode]
                    ? `${ERROR_CODE_LABELS[run.errorCode]}: `
                    : ""}
                  {run.error}
                </Text>
              </Alert>
            )}
            {run.reportData?.response && (
              <Box>
                <Text size="xs" fw={500}>결과:</Text>
                <Text size="xs" c="dimmed" lineClamp={3}>
                  {run.reportData.response}
                </Text>
              </Box>
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

function RunDetailModal({ run, onClose }: { run: AgentRun | null; onClose: () => void }) {
  if (!run) return null;

  const status = STATUS_CONFIG[run.status];
  const durationMs = run.finishedAt && run.startedAt
    ? run.finishedAt - run.startedAt
    : run.startedAt
    ? Date.now() - run.startedAt
    : 0;

  return (
    <Modal opened={!!run} onClose={onClose} title="실행 상세" size="lg">
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
          <Card withBorder p="sm">
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
              {run.errorCode && ERROR_CODE_LABELS[run.errorCode]
                ? ERROR_CODE_LABELS[run.errorCode]
                : "오류"}
            </Text>
            <Text size="xs">{run.error}</Text>
          </Alert>
        )}

        {run.reportData?.response && (
          <Box>
            <Text size="sm" fw={500}>결과</Text>
            <Card withBorder p="sm" mt="xs">
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {run.reportData.response}
              </Text>
            </Card>
          </Box>
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
    </Modal>
  );
}
