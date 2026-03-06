"use client";

import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
  TypographyStylesProvider,
} from "@mantine/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useBlogAssistant } from "../model/useBlogAssistant";

const EXAMPLE_QUESTIONS = [
  "최근에 React 관련해서 쓴 글 요약해줘",
  "TypeScript 타입 시스템에 대해 다룬 글 있어?",
  "컴파일러 관련 글 찾아줘",
  "성능 최적화에 대한 글 있어?",
];

export function BlogAssistant() {
  const { question, setQuestion, answer, sources, isLoading, error, handleAsk, canAsk } =
    useBlogAssistant();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (canAsk) handleAsk();
    }
  };

  return (
    <Stack gap="md">
      <Textarea
        label="질문"
        placeholder="예) 최근에 React 성능 최적화에 대해 쓴 글 요약해줘"
        value={question}
        onChange={(event) => setQuestion(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        minRows={3}
        autoFocus
      />
      <Button onClick={handleAsk} disabled={!canAsk}>
        블로그에 물어보기
      </Button>

      {isLoading && (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            답변을 가져오는 중...
          </Text>
        </Group>
      )}

      {error && <Alert color="red">{error}</Alert>}

      {!answer && !isLoading && (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            예시 질문을 클릭해보세요
          </Text>
          <Group gap="xs">
            {EXAMPLE_QUESTIONS.map((q) => (
              <Badge
                key={q}
                variant="light"
                style={{ cursor: "pointer" }}
                onClick={() => setQuestion(q)}
              >
                {q}
              </Badge>
            ))}
          </Group>
        </Stack>
      )}

      {answer && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            <Title order={4}>답변</Title>
            <TypographyStylesProvider>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
            </TypographyStylesProvider>
          </Stack>
        </Paper>
      )}

      {sources.length > 0 && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            <Title order={5}>출처</Title>
            {sources.map((source) => (
              <Paper
                key={source.url}
                component="a"
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                withBorder
                p="sm"
                radius="sm"
                style={{ textDecoration: "none", display: "block" }}
              >
                <Text size="sm" fw={500}>
                  {source.title}
                </Text>
                {source.publishedAt && (
                  <Text size="xs" c="dimmed" mt={2}>
                    {source.publishedAt}
                  </Text>
                )}
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
