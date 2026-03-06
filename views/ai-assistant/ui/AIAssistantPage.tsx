import { Space, Text, Title } from "@mantine/core";
import { BlogAssistant } from "@/features/blog-assistant";

export function AIAssistantPage() {
  return (
    <>
      <Title>Ask My Blog</Title>
      <Space h="sm" />
      <Text c="dimmed">
        블로그 글을 근거로 답변하는 RAG + Tool Calling 데모입니다.
      </Text>
      <Space h="xl" />
      <BlogAssistant />
    </>
  );
}
