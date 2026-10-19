"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  UnstyledButton,
} from "@mantine/core";
import { FinanceModal } from "./FinanceModal";
import { BOT_TEMPLATE_CATALOG, type BotTemplateMeta } from "./bot-template-meta";
import { BotAvatar } from "./bot-avatar";
import type { BotTemplate } from "../store/finance-store";
import classes from "./finance-ui.module.css";

const CREATE_TEMPLATES = BOT_TEMPLATE_CATALOG.filter((t) => t.template !== "main");

export function CreateBotModal({
  opened,
  onClose,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<BotTemplate>("kr-stock");
  const [instructions, setInstructions] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError("봇 이름을 입력해주세요.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/finance/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          template,
          instructions: instructions.trim() || undefined,
        }),
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "봇 생성에 실패했습니다.");
        return;
      }

      setName("");
      setTemplate("kr-stock");
      setInstructions("");
      onCreated();
      onClose();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <FinanceModal opened={opened} onClose={onClose} title="새 Bot 만들기" size="lg" data-testid="create-bot-modal">
      <Stack gap="md">
        <Text size="sm" className={classes.loginIntro}>
          전문 템플릿을 고르면 도구와 기본 지시가 자동 설정됩니다. 메인 봇은 언제든 다른 봇을 호출할 수 있습니다.
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          {CREATE_TEMPLATES.map((item) => (
            <TemplatePickerCard
              key={item.template}
              item={item}
              selected={template === item.template}
              onSelect={() => setTemplate(item.template as BotTemplate)}
            />
          ))}
        </SimpleGrid>
        <TextInput
          data-testid="bot-name-input"
          label="봇 이름"
          placeholder="예: 한국 시장 모니터링 봇"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Textarea
          data-testid="bot-instructions-input"
          label="커스텀 지시사항 (선택)"
          placeholder="봇에게 추가 지시사항을 입력하세요..."
          value={instructions}
          onChange={(e) => setInstructions(e.currentTarget.value)}
          autosize
          minRows={3}
          maxRows={6}
        />
        {error && <Alert color="red" data-testid="create-bot-error">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>취소</Button>
          <Button onClick={handleCreate} loading={isCreating} data-testid="submit-create-bot">생성</Button>
        </Group>
      </Stack>
    </FinanceModal>
  );
}

function TemplatePickerCard({
  item,
  selected,
  onSelect,
}: {
  item: BotTemplateMeta;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onSelect}
      data-testid={`bot-template-picker-${item.template}`}
      className={classes.surfaceCard}
      style={{
        padding: 12,
        textAlign: "left",
        borderColor: selected ? "#c74219" : undefined,
        boxShadow: selected ? "inset 0 0 0 1px #c74219" : undefined,
      }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <BotAvatar botId={`template-picker-${item.template}`} size={32} />
        <Box style={{ minWidth: 0 }}>
          <Text size="sm" fw={500}>{item.label}</Text>
          <Text size="xs" className={classes.muted}>{item.roleLine}</Text>
          <Text size="xs" mt={4} className={classes.muted} lineClamp={2}>{item.description}</Text>
        </Box>
      </Group>
    </UnstyledButton>
  );
}
