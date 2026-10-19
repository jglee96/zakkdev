"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Group,
  Select,
  Stack,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useFinanceStore } from "../store/finance-store";
import { FinanceModal } from "./FinanceModal";
import { ROUTINE_TIMEZONE_OPTIONS } from "./routine-schedule";
import { FINANCE_COMBOBOX_PORTAL_PROPS } from "@/shared/site-layout/modal-root";

export function CreateRoutineModal({
  opened,
  onClose,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const bots = useFinanceStore((s) => s.bots);
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
            data={ROUTINE_TIMEZONE_OPTIONS}
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
