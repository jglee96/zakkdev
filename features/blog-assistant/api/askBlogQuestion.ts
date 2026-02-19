import type { AskBlogResponse, AssistantSource } from "../model/types";

export async function askBlogQuestion(
  question: string
): Promise<{ answer: string; sources: AssistantSource[] }> {
  const response = await fetch("/api/ai/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const data = (await response.json()) as AskBlogResponse;
  if (!response.ok) {
    throw new Error(data.error || "요청을 처리하지 못했습니다.");
  }

  return {
    answer: data.answer || "",
    sources: data.sources || [],
  };
}
