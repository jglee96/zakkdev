"use client";

import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCalendarTime,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconEdit,
} from "@tabler/icons-react";
import { useFinanceStore, type Routine, type RoutineStatus } from "../store/finance-store";
import { FinanceModal } from "./FinanceModal";
import { FINANCE_COMBOBOX_PORTAL_PROPS } from "@/shared/site-layout/modal-root";

const STATUS_BADGE: Record<RoutineStatus, { color: string; label: string }> = {
  pending: { color: "yellow", label: "대기" },
  active: { color: "green", label: "활성" },
  paused: { color: "gray", label: "일시정지" },
  deleted: { color: "red", label: "삭제됨" },
};

const TIMEZONE_OPTIONS = [
  { value: "Asia/Seoul", label: "서울 (KST)" },
  { value: "America/New_York", label: "뉴욕 (EST)" },
  { value: "Europe/London", label: "런던 (GMT)" },
  { value: "Asia/Tokyo", label: "도쿄 (JST)" },
  { value: "UTC", label: "UTC" },
];

const TIMEZONE_LABELS: Record<string, string> = {
  "Asia/Seoul": "KST",
  "America/New_York": "EST",
  "Europe/London": "GMT",
  "Asia/Tokyo": "JST",
  "UTC": "UTC",
};

function formatCronSchedule(cronExpr: string, timezone: string): string {
  const parts = cronExpr.split(" ");
  if (parts.length < 5) return cronExpr;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const tzLabel = TIMEZONE_LABELS[timezone] || timezone;

  const dayNames: Record<string, string> = {
    "0": "일", "1": "월", "2": "화", "3": "수", "4": "목", "5": "금", "6": "토", "7": "일",
  };

  let schedule = "";

  if (dayOfWeek === "*" && dayOfMonth === "*" && month === "*") {
    schedule = "매일";
  } else if (dayOfWeek === "1-5" && dayOfMonth === "*" && month === "*") {
    schedule = "평일";
  } else if (dayOfWeek === "0,6" && dayOfMonth === "*" && month === "*") {
    schedule = "주말";
  } else if (dayOfWeek !== "*" && dayOfMonth === "*" && month === "*") {
    const days = dayOfWeek.split(",").map((d) => dayNames[d] || d).join(",");
    schedule = `매주 ${days}요일`;
  } else {
    schedule = cronExpr;
  }

  if (hour !== "*" && minute !== "*") {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const period = h < 12 ? "오전" : "오후";
    const displayHour = h % 12 || 12;
    schedule += ` ${period} ${displayHour}시`;
    if (m > 0) schedule += ` ${m}분`;
  }

  return `${schedule} (${tzLabel})`;
}

export function RoutineList({ onRefresh }: { onRefresh: () => void }) {
  const { routines, bots, isLoadingRoutines, routinesError } = useFinanceStore();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);

  const activeRoutines = routines.filter((r) => r.status !== "deleted");

  return (
    <Stack gap="md" w="100%" data-testid="routine-list-container">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" w="100%" style={{ minWidth: 0 }}>
        <Title order={4}>정기 실행 (루틴)</Title>
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
        <Card withBorder p="xl" ta="center" data-testid="routines-empty">
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
              botName={bots.find((b) => b.id === routine.botId)?.name}
              onSelect={() => setSelectedRoutine(routine)}
              onRefresh={onRefresh}
            />
          ))}
        </Stack>
      )}

      <CreateRoutineModal opened={createOpened} onClose={closeCreate} onCreated={onRefresh} />
      <RoutineDetailModal routine={selectedRoutine} onClose={() => setSelectedRoutine(null)} onUpdated={onRefresh} />
    </Stack>
  );
}

function RoutineCard({
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
    <Card withBorder padding="sm" data-testid={`routine-card-${routine.name}`}>
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

function CreateRoutineModal({
  opened,
  onClose,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { bots } = useFinanceStore();
  const [name, setName] = useState("");
  const [botId, setBotId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [cronExpr, setCronExpr] = useState("0 9 * * 1-5");
  const [timezone, setTimezone] = useState("Asia/Seoul");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const botOptions = bots
    .filter((b) => b.status === "active")
    .map((b) => ({ value: b.id, label: b.name }));

  async function handleCreate() {
    if (!name.trim() || !botId || !instruction.trim() || !cronExpr.trim()) {
      setError("모든 필수 항목을 입력해주세요.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/finance/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          botId,
          instruction: instruction.trim(),
          cronExpr: cronExpr.trim(),
          timezone,
        }),
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "루틴 생성에 실패했습니다.");
        return;
      }

      setName("");
      setBotId(null);
      setInstruction("");
      setCronExpr("0 9 * * 1-5");
      onCreated();
      onClose();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <FinanceModal opened={opened} onClose={onClose} title="루틴 생성" size="lg" data-testid="create-routine-modal">
      <Stack gap="md">
        <TextInput
          data-testid="routine-name-input"
          label="루틴 이름"
          placeholder="예: 매일 아침 시장 분석"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Select
          data-testid="routine-bot-select"
          label="실행할 봇"
          data={botOptions}
          value={botId}
          onChange={setBotId}
          placeholder="봇을 선택하세요"
          required
          comboboxProps={FINANCE_COMBOBOX_PORTAL_PROPS}
        />
        <Textarea
          data-testid="routine-instruction-input"
          label="실행 지시사항"
          placeholder="봇에게 전달할 지시사항을 입력하세요..."
          value={instruction}
          onChange={(e) => setInstruction(e.currentTarget.value)}
          autosize
          minRows={3}
          maxRows={6}
          required
        />
        <Group grow>
          <TextInput
            data-testid="routine-cron-input"
            label="Cron 표현식"
            placeholder="0 9 * * 1-5"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.currentTarget.value)}
            description="예: 0 9 * * 1-5 (평일 오전 9시)"
            required
          />
          <Select
            data-testid="routine-timezone-select"
            label="시간대"
            data={TIMEZONE_OPTIONS}
            value={timezone}
            onChange={(v) => v && setTimezone(v)}
            required
            comboboxProps={FINANCE_COMBOBOX_PORTAL_PROPS}
          />
        </Group>
        {error && <Alert color="red" data-testid="create-routine-error">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>취소</Button>
          <Button onClick={handleCreate} loading={isCreating} data-testid="submit-create-routine">생성</Button>
        </Group>
      </Stack>
    </FinanceModal>
  );
}

function RoutineDetailModal({
  routine,
  onClose,
  onUpdated,
}: {
  routine: Routine | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [instruction, setInstruction] = useState("");
  const [cronExpr, setCronExpr] = useState("");
  const [timezone, setTimezone] = useState("Asia/Seoul");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useState(() => {
    if (routine) {
      setName(routine.name);
      setInstruction(routine.instruction);
      setCronExpr(routine.cronExpr);
      setTimezone(routine.timezone);
    }
  });

  if (!routine) return null;

  const routineId = routine.id;

  async function handleUpdate() {
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/finance/routines/${routineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          instruction: instruction.trim() || undefined,
          cronExpr: cronExpr.trim() || undefined,
          timezone,
        }),
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "루틴 수정에 실패했습니다.");
        return;
      }

      onUpdated();
      onClose();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (!confirm("정말로 이 루틴을 삭제하시겠습니까?")) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/finance/routines/${routineId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "루틴 삭제에 실패했습니다.");
        return;
      }

      onUpdated();
      onClose();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <FinanceModal opened={!!routine} onClose={onClose} title="루틴 편집" size="lg" data-testid="edit-routine-modal">
      <Stack gap="md">
        <TextInput
          label="루틴 이름"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Textarea
          label="실행 지시사항"
          value={instruction}
          onChange={(e) => setInstruction(e.currentTarget.value)}
          autosize
          minRows={3}
          maxRows={8}
        />
        <Group grow>
          <TextInput
            label="Cron 표현식"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.currentTarget.value)}
          />
          <Select
            label="시간대"
            data={TIMEZONE_OPTIONS}
            value={timezone}
            onChange={(v) => v && setTimezone(v)}
            comboboxProps={FINANCE_COMBOBOX_PORTAL_PROPS}
          />
        </Group>
        <Text size="xs" c="dimmed">
          생성: {new Date(routine.createdAt).toLocaleString("ko-KR")} |
          버전: {routine.version}
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="space-between">
          <Button
            color="red"
            variant="subtle"
            leftSection={<IconTrash size={14} />}
            onClick={handleDelete}
            loading={isDeleting}
          >
            삭제
          </Button>
          <Group>
            <Button variant="subtle" onClick={onClose}>취소</Button>
            <Button onClick={handleUpdate} loading={isUpdating}>저장</Button>
          </Group>
        </Group>
      </Stack>
    </FinanceModal>
  );
}
