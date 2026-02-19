"use client";

import {
  Alert,
  Anchor,
  Button,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useBlogAssistant } from "../model/useBlogAssistant";

export function BlogAssistant() {
  const { question, setQuestion, answer, sources, isLoading, error, handleAsk, canAsk } =
    useBlogAssistant();

  return (
    <Stack gap="md">
      <Textarea
        label="질문"
        placeholder="예) 최근에 React 성능 최적화에 대해 쓴 글 요약해줘"
        value={question}
        onChange={(event) => setQuestion(event.currentTarget.value)}
        minRows={3}
      />
      <Button onClick={handleAsk} disabled={!canAsk}>
        블로그에 물어보기
      </Button>

      {isLoading && <Loader size="sm" />}
      {error && <Alert color="red">{error}</Alert>}

      {answer && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            <Title order={4}>답변</Title>
            <Text style={{ whiteSpace: "pre-wrap" }}>{answer}</Text>
          </Stack>
        </Paper>
      )}

      {sources.length > 0 && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            <Title order={5}>출처</Title>
            {sources.map((source) => (
              <Anchor key={source.url} href={source.url} underline="always">
                {source.title}
                {source.publishedAt ? ` (${source.publishedAt})` : ""}
              </Anchor>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
