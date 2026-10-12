"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import TextareaAutosize from "react-textarea-autosize";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconRobot, IconSend, IconUser, IconAlertCircle, IconClock, IconCoin } from "@tabler/icons-react";
import { useFinanceStore, type Message, type ChatResponse } from "../store/finance-store";
import { ChatMessageContent } from "./chat-message-content";

const MAIN_BOT_ID = "main-bot";

export function ChatPanel() {
  const [input, setInput] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);

  const {
    bots,
    selectedBotId,
    setSelectedBotId,
    messages,
    addMessage,
    isSendingMessage,
    setIsSendingMessage,
    chatError,
    setChatError,
    lastChatResponse,
    setLastChatResponse,
  } = useFinanceStore();

  const activeBotId = selectedBotId || MAIN_BOT_ID;
  const botMessages = messages.filter((m) => m.botId === activeBotId);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [botMessages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSendingMessage || !input.trim()) return;

    const userMessage: Message = {
      id: `local-${Date.now()}`,
      botId: activeBotId,
      role: "user",
      content: input.trim(),
      createdAt: Date.now(),
    };

    addMessage(userMessage);
    setInput("");
    setIsSendingMessage(true);
    setChatError(null);
    setLastChatResponse(null);

    try {
      const response = await fetch("/api/finance/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: activeBotId, message: userMessage.content }),
        credentials: "same-origin",
      });

      const data = await response.json();

      if (!response.ok) {
        setChatError(data.error || "메시지 전송에 실패했습니다.");
        return;
      }

      const chatResponse = data as ChatResponse;
      setLastChatResponse(chatResponse);

      if (chatResponse.response) {
        const assistantMessage: Message = {
          id: chatResponse.runId,
          botId: activeBotId,
          role: "assistant",
          content: chatResponse.response,
          createdAt: Date.now(),
        };
        addMessage(assistantMessage);
      }

      if (chatResponse.error) {
        setChatError(chatResponse.error);
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsSendingMessage(false);
    }
  }

  const botOptions = [
    { value: MAIN_BOT_ID, label: "메인 봇 (자동 생성)" },
    ...bots.filter((b) => b.id !== MAIN_BOT_ID).map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <Stack flex={1} mih={0} mah="100%" w="100%" gap="sm" style={{ flex: 1, minHeight: 0 }} data-testid="chat-panel">
      <Group
        justify="space-between"
        align="center"
        wrap="wrap"
        gap="sm"
        w="100%"
        data-testid="chat-page-header"
        style={{ flexShrink: 0, minWidth: 0 }}
      >
        <Title order={4} data-testid="chat-page-title" style={{ flex: "0 0 auto" }}>
          채팅
        </Title>
        <Box style={{ flex: "1 1 160px", minWidth: 140, maxWidth: 320 }}>
          <Select
            data-testid="bot-selector"
            data={botOptions}
            value={activeBotId}
            onChange={(v) => setSelectedBotId(v)}
            placeholder="봇 선택"
            w="100%"
            size="sm"
            comboboxProps={{ withinPortal: true }}
          />
        </Box>
      </Group>

      <Paper
        withBorder
        flex={1}
        mih={0}
        style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1, minHeight: 0 }}
      >
        <ScrollArea flex={1} mih={0} viewportRef={viewportRef} p="md" data-testid="chat-messages">
          {botMessages.length === 0 ? (
            <Box ta="center" py="xl" data-testid="chat-empty">
              <ThemeIcon size={48} radius="xl" variant="light" color="blue" mb="md">
                <IconRobot size={28} />
              </ThemeIcon>
              <Text c="dimmed">금융 리서치에 대해 질문해 보세요.</Text>
              <Text size="sm" c="dimmed" mt="xs">
                예: &quot;삼성전자 최근 공시 분석해줘&quot;
              </Text>
            </Box>
          ) : (
            <Stack gap="md">
              {botMessages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isSendingMessage && (
                <Group gap="xs" data-testid="chat-loading">
                  <ThemeIcon size="sm" radius="xl" variant="light" color="blue">
                    <IconRobot size={14} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed">답변 생성 중...</Text>
                </Group>
              )}
            </Stack>
          )}
        </ScrollArea>

        {chatError && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} m="md" mt={0} data-testid="chat-error">
            {chatError}
          </Alert>
        )}

        {lastChatResponse && (
          <ResponseStats response={lastChatResponse} />
        )}

        <Box
          p="md"
          pt={0}
          className="finance-chat-composer"
          style={{ flexShrink: 0 }}
          data-testid="chat-composer"
        >
          <form onSubmit={handleSubmit} data-testid="chat-form">
            <Group gap="xs" align="center" wrap="nowrap" w="100%" style={{ minWidth: 0 }}>
              <Box style={{ flex: 1, minWidth: 0, alignSelf: "center" }}>
                <TextareaAutosize
                  data-testid="chat-input-textarea"
                  className="finance-chat-textarea"
                  placeholder="메시지를 입력하세요..."
                  value={input}
                  onChange={(e) => setInput(e.currentTarget.value)}
                  disabled={isSendingMessage}
                  minRows={1}
                  maxRows={4}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
              </Box>
              <Button
                type="submit"
                data-testid="chat-send"
                size="sm"
                loading={isSendingMessage}
                disabled={!input.trim()}
                leftSection={<IconSend size={16} />}
                style={{ flexShrink: 0, alignSelf: "center" }}
              >
                전송
              </Button>
            </Group>
          </form>
        </Box>
      </Paper>
    </Stack>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <Group gap="sm" align="flex-start" wrap="nowrap" w="100%" style={{ minWidth: 0 }}>
      <ThemeIcon
        size="sm"
        radius="xl"
        variant="light"
        color={isUser ? "gray" : "blue"}
        mt={4}
      >
        {isUser ? <IconUser size={14} /> : <IconRobot size={14} />}
      </ThemeIcon>
      <Card
        shadow="xs"
        padding="sm"
        radius="md"
        bg={isUser ? "gray.1" : "blue.0"}
        style={{ maxWidth: "min(100%, 720px)", minWidth: 0, flex: 1 }}
      >
        {isUser || !message.content ? (
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {message.content}
          </Text>
        ) : (
          <ChatMessageContent content={message.content} />
        )}
      </Card>
    </Group>
  );
}

function ResponseStats({ response }: { response: ChatResponse }) {
  const statusColor = {
    completed: "green",
    timeout: "yellow",
    error: "red",
    budget_exceeded: "orange",
  }[response.status];

  return (
    <Group gap="xs" px="md" pb="xs" wrap="wrap">
      <Badge size="sm" variant="light" color={statusColor}>
        {response.status === "completed" ? "완료" :
         response.status === "timeout" ? "시간 초과" :
         response.status === "budget_exceeded" ? "예산 초과" : "오류"}
      </Badge>
      <Badge size="sm" variant="light" color="gray" leftSection={<IconClock size={10} />}>
        {(response.durationMs / 1000).toFixed(1)}초
      </Badge>
      <Badge size="sm" variant="light" color="gray" leftSection={<IconCoin size={10} />}>
        ${response.usage.costUsd.toFixed(4)}
      </Badge>
      <Badge size="sm" variant="light" color="gray">
        {response.usage.steps}단계
      </Badge>
    </Group>
  );
}
