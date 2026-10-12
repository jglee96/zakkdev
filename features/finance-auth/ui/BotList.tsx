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
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconRefresh, IconRobot, IconSettings, IconTrash } from "@tabler/icons-react";
import { useFinanceStore, type Bot, type BotTemplate } from "../store/finance-store";

const TEMPLATE_OPTIONS = [
  { value: "main", label: "메인 봇 - 종합 금융 분석" },
  { value: "kr-stock", label: "한국 주식 - 국내 시장 전문" },
  { value: "us-stock", label: "미국 주식 - 해외 시장 전문" },
  { value: "index-futures", label: "지수 선물 - 파생상품 전문" },
];

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  active: { color: "green", label: "활성" },
  paused: { color: "yellow", label: "일시정지" },
  archived: { color: "gray", label: "보관됨" },
};

export function BotList({ onRefresh }: { onRefresh: () => void }) {
  const { bots, isLoadingBots, botsError } = useFinanceStore();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>봇 관리</Title>
        <Group gap="xs">
          <Tooltip label="새로고침">
            <ActionIcon variant="subtle" onClick={onRefresh}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Button leftSection={<IconPlus size={16} />} size="sm" onClick={openCreate}>
            봇 생성
          </Button>
        </Group>
      </Group>

      {botsError && (
        <Alert color="red">{botsError}</Alert>
      )}

      {isLoadingBots ? (
        <Box ta="center" py="xl">
          <Loader />
        </Box>
      ) : bots.length === 0 ? (
        <Card withBorder p="xl" ta="center">
          <IconRobot size={48} color="gray" style={{ margin: "0 auto", marginBottom: 16 }} />
          <Text c="dimmed">아직 생성된 봇이 없습니다.</Text>
          <Button mt="md" onClick={openCreate}>첫 봇 만들기</Button>
        </Card>
      ) : (
        <Stack gap="sm">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} onSelect={() => setSelectedBot(bot)} />
          ))}
        </Stack>
      )}

      <CreateBotModal opened={createOpened} onClose={closeCreate} onCreated={onRefresh} />
      <BotDetailModal bot={selectedBot} onClose={() => setSelectedBot(null)} onUpdated={onRefresh} />
    </Stack>
  );
}

function BotCard({ bot, onSelect }: { bot: Bot; onSelect: () => void }) {
  const status = STATUS_BADGE[bot.status];

  return (
    <Card withBorder padding="sm" style={{ cursor: "pointer" }} onClick={onSelect}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <IconRobot size={20} />
          <Box>
            <Text fw={500}>{bot.name}</Text>
            <Text size="xs" c="dimmed">
              {TEMPLATE_OPTIONS.find((t) => t.value === bot.template)?.label || bot.template}
            </Text>
          </Box>
        </Group>
        <Group gap="xs">
          <Badge size="sm" color={status.color}>{status.label}</Badge>
          <ActionIcon variant="subtle" size="sm">
            <IconSettings size={14} />
          </ActionIcon>
        </Group>
      </Group>
    </Card>
  );
}

function CreateBotModal({
  opened,
  onClose,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<string>("main");
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
      setTemplate("main");
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
    <Modal opened={opened} onClose={onClose} title="봇 생성">
      <Stack gap="md">
        <TextInput
          label="봇 이름"
          placeholder="예: 내 분석 봇"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Select
          label="템플릿"
          data={TEMPLATE_OPTIONS}
          value={template}
          onChange={(v) => v && setTemplate(v)}
        />
        <Textarea
          label="커스텀 지시사항 (선택)"
          placeholder="봇에게 추가 지시사항을 입력하세요..."
          value={instructions}
          onChange={(e) => setInstructions(e.currentTarget.value)}
          autosize
          minRows={3}
          maxRows={6}
        />
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>취소</Button>
          <Button onClick={handleCreate} loading={isCreating}>생성</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function BotDetailModal({
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

  useState(() => {
    if (bot) {
      setName(bot.name);
      setInstructions(bot.instructions || "");
      setStatus(bot.status);
    }
  });

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
    <Modal opened={!!bot} onClose={onClose} title="봇 설정" size="lg">
      <Stack gap="md">
        <TextInput
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
        />
        <Textarea
          label="지시사항"
          value={instructions}
          onChange={(e) => setInstructions(e.currentTarget.value)}
          autosize
          minRows={3}
          maxRows={8}
        />
        <Group gap="xs" wrap="wrap">
          <Text size="sm" fw={500}>사용 가능 도구:</Text>
          {bot.allowedTools.map((tool) => (
            <Badge key={tool} size="sm" variant="outline">{tool}</Badge>
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
    </Modal>
  );
}
