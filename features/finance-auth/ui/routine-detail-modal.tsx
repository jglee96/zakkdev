"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import type { Routine } from "../store/finance-store";
import { FinanceModal } from "./FinanceModal";
import { ROUTINE_TIMEZONE_OPTIONS } from "./routine-schedule";
import { FINANCE_COMBOBOX_PORTAL_PROPS } from "@/shared/site-layout/modal-root";

export function RoutineDetailModal({
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
        <TextInput label="루틴 이름" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Textarea
          label="실행 지시사항"
          value={instruction}
          onChange={(e) => setInstruction(e.currentTarget.value)}
          autosize
          minRows={3}
          maxRows={8}
        />
        <Group grow>
          <TextInput label="Cron 표현식" value={cronExpr} onChange={(e) => setCronExpr(e.currentTarget.value)} />
          <Select
            label="시간대"
            data={ROUTINE_TIMEZONE_OPTIONS}
            value={timezone}
            onChange={(v) => v && setTimezone(v)}
            comboboxProps={FINANCE_COMBOBOX_PORTAL_PROPS}
          />
        </Group>
        <Text size="xs" c="dimmed">
          생성: {new Date(routine.createdAt).toLocaleString("ko-KR")} | 버전: {routine.version}
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
