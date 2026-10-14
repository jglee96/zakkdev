"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import TextareaAutosize from "react-textarea-autosize";
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconRobot, IconSend, IconAlertCircle, IconClock, IconCoin } from "@tabler/icons-react";
import { useFinanceStore, type Message, type ChatResponse } from "../store/finance-store";
import { BotAvatar } from "./bot-avatar";
import { ChatMessageContent } from "./chat-message-content";
import { FinanceOnboarding } from "./finance-onboarding";
import { getActiveBotDisplayMeta } from "./bot-template-meta";
import { MAIN_BOT_ID } from "../constants";
import classes from "./finance-ui.module.css";

export function ChatPanel({ onOpenCreateBot }: { onOpenCreateBot: () => void }) {
  const [input, setInput] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const {
    bots,
    selectedBotId,
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
  const display = getActiveBotDisplayMeta(bots, selectedBotId);

  const specialistCount = bots.filter((b) => b.id !== MAIN_BOT_ID && b.template !== "main").length;

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [botMessages, activeBotId]);

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

  return (
    <Box className={classes.chatPanelRoot} data-testid="chat-panel">
      <Box className={classes.chatHeaderBar} px="md" py="sm">
        <Group
          justify="space-between"
          align="flex-end"
          wrap="wrap"
          gap="sm"
          w="100%"
          data-testid="chat-page-header"
          className={classes.chatThreadColumn}
          style={{ minWidth: 0 }}
        >
          <Box style={{ minWidth: 0 }}>
            <Text size="sm" fw={500} data-testid="chat-page-title" truncate>
              {display.name}
            </Text>
            <Text size="xs" className={classes.muted} data-testid="chat-bot-role-line" truncate>
              {display.roleLine}
            </Text>
          </Box>
        </Group>
      </Box>

      <Box px="md" pt="sm" style={{ flexShrink: 0 }}>
        <Box className={classes.chatThreadColumn}>
          <FinanceOnboarding
            specialistBotCount={specialistCount}
            onCreateBot={onOpenCreateBot}
            onStarterPrompt={(text) => setInput(text)}
          />
        </Box>
      </Box>

      <Box style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <ScrollArea flex={1} mih={0} viewportRef={viewportRef} px="md" py="md" data-testid="chat-messages">
          <Box className={classes.chatThreadColumn}>
            {botMessages.length === 0 ? (
              <Box ta="center" py="xl" data-testid="chat-empty">
                <ThemeIcon size={48} radius="xl" variant="light" color="braun-red" mb="md">
                  <IconRobot size={28} />
                </ThemeIcon>
                <Text className={classes.muted}>{display.name}에게 질문해 보세요.</Text>
                <Text size="sm" className={classes.muted} mt="xs">
                  예: &quot;삼성전자 최근 공시 분석해줘&quot;
                </Text>
              </Box>
            ) : (
              <Stack gap="md">
                {botMessages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} botId={activeBotId} />
                ))}
                {isSendingMessage && (
                  <Box className={classes.chatMessageRowBot} data-testid="chat-loading">
                    <BotAvatar botId={activeBotId} size={32} />
                    <Text size="sm" c="dimmed" mt={6}>답변 생성 중...</Text>
                  </Box>
                )}
              </Stack>
            )}
          </Box>
        </ScrollArea>

        {chatError && (
          <Box px="md" className={classes.chatThreadColumn}>
            <Alert color="red" icon={<IconAlertCircle size={16} />} mb="xs" data-testid="chat-error">
              {chatError}
            </Alert>
          </Box>
        )}

        {lastChatResponse && lastChatResponse.botId === activeBotId && (
          <Box px="md" className={classes.chatThreadColumn}>
            <ResponseStats response={lastChatResponse} />
          </Box>
        )}

        <Box
          px="md"
          py="md"
          className={`${classes.chatComposerBar} finance-chat-composer`}
          data-testid="chat-composer"
        >
          <Box className={classes.chatThreadColumn}>
            <form onSubmit={handleSubmit} data-testid="chat-form">
              <Group gap="xs" align="center" wrap="nowrap" w="100%" style={{ minWidth: 0 }}>
                <Box style={{ flex: 1, minWidth: 0, alignSelf: "center" }}>
                  {isMobile ? (
                    <TextInput
                      data-testid="chat-input-textarea"
                      placeholder="메시지를 입력하세요..."
                      value={input}
                      onChange={(e) => setInput(e.currentTarget.value)}
                      disabled={isSendingMessage}
                      size="sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                    />
                  ) : (
                    <TextareaAutosize
                      data-testid="chat-input-textarea"
                      className="finance-chat-textarea"
                      placeholder="메시지를 입력하세요..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
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
                  )}
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
        </Box>
      </Box>
    </Box>
  );
}

function MessageBubble({ message, botId }: { message: Message; botId: string }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <Box className={classes.chatMessageRowUser} data-testid="chat-message-user">
        <Box className={`${classes.chatBubble} ${classes.chatBubbleUser}`}>
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {message.content}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box className={classes.chatMessageRowBot} data-testid="chat-message-assistant">
      <BotAvatar botId={botId} size={32} />
      <Box className={`${classes.chatBubble} ${classes.chatBubbleAssistant}`}>
        {message.content ? (
          <ChatMessageContent content={message.content} />
        ) : (
          <Text size="sm" className={classes.muted}>—</Text>
        )}
      </Box>
    </Box>
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
