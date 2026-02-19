"use client";

import { useCallback, useState } from "react";
import { askBlogQuestion } from "../api/askBlogQuestion";
import type { AssistantSource } from "./types";

export function useBlogAssistant() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<AssistantSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAsk = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await askBlogQuestion(trimmed);
      setAnswer(result.answer);
      setSources(result.sources);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, question]);

  return {
    question,
    setQuestion,
    answer,
    sources,
    isLoading,
    error,
    handleAsk,
    canAsk: question.trim().length > 0 && !isLoading,
  };
}
