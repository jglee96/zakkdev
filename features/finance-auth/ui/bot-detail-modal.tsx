"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import type { Bot } from "../store/finance-store";
import { getToolLabelKo, normalizeToolCode } from "./tool-labels";
import { FinanceModal } from "./FinanceModal";
import { FINANCE_COMBOBOX_PORTAL_PROPS } from "@/shared/site-layout/modal-root";

export function BotDetailModal({
  bot,
  onClose,
  onUpdated,
}: {
  bot: Bot | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bot) {
      setName("");
      setInstructions("");
      setStatus("active");
      return;
    }
    setName(bot.name);
    setInstructions(bot.instructions || "");
    setStatus(bot.status);
  }, [bot]);

  if (!bot) return null;

  const botId = bot.id;

  async function handleUpdate() {
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/finance/bots/${botId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          instructions: instructions.trim() || undefined,
          status,
        }),
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "봇 수정에 실패했습니다.");
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

  return (
    <FinanceModal opened={!!bot} onClose={onClose} title="봇 설정" size="lg" data-testid="bot-detail-modal">
      <Stack gap="md">
        <TextInput
          data-testid="bot-detail-name-input"
          label="봇 이름"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Select
          label="상태"
          data={[
            { value: "active", label: "활성" },
            { value: "paused", label: "일시정지" },
            { value: "archived", label: "보관" },
          ]}
          value={status}
          onChange={(v) => v && setStatus(v)}
          comboboxProps={FINANCE_COMBOBOX_PORTAL_PROPS}
        />
        <Textarea
          data-testid="bot-detail-instructions-input"
          label="지시사항"
          value={instructions}
          onChange={(e) => setInstructions(e.currentTarget.value)}
          autosize
          minRows={3}
          maxRows={8}
        />
        <Group gap="xs" wrap="wrap" data-testid="bot-detail-tools">
          <Text size="sm" fw={500}>사용 가능 도구:</Text>
          {bot.allowedTools.map((tool) => (
            <Tooltip key={tool} label={normalizeToolCode(tool)} withArrow>
              <Badge size="sm" variant="outline" data-testid={`bot-tool-chip-${normalizeToolCode(tool)}`}>
                {getToolLabelKo(tool)}
              </Badge>
            </Tooltip>
          ))}
        </Group>
        <Text size="xs" c="dimmed">
          생성: {new Date(bot.createdAt).toLocaleString("ko-KR")} |
          수정: {new Date(bot.updatedAt).toLocaleString("ko-KR")}
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>취소</Button>
          <Button onClick={handleUpdate} loading={isUpdating}>저장</Button>
        </Group>
      </Stack>
    </FinanceModal>
  );
}
