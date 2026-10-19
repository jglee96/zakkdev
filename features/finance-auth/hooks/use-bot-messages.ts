"use client";

import { useEffect, useRef } from "react";
import { useFinanceStore, type Message } from "../store/finance-store";

export function useBotMessages(botId: string) {
  const fetchGenerationRef = useRef(0);

  const isCached = useFinanceStore((s) => Boolean(s.messagesLoadedBotIds[botId]));
  const mergeMessagesForBot = useFinanceStore((s) => s.mergeMessagesForBot);
  const markMessagesLoaded = useFinanceStore((s) => s.markMessagesLoaded);
  const setMessagesError = useFinanceStore((s) => s.setMessagesError);
  const setMessagesLoadingBotId = useFinanceStore((s) => s.setMessagesLoadingBotId);

  useEffect(() => {
    if (!botId || isCached) {
      return;
    }

    const generation = ++fetchGenerationRef.current;
    setMessagesLoadingBotId(botId);
    setMessagesError(null);

    void (async () => {
      try {
        const response = await fetch(
          `/api/finance/bots/${encodeURIComponent(botId)}/messages?limit=50`,
          { credentials: "same-origin" },
        );
        if (!response.ok) {
          throw new Error("메시지 조회 실패");
        }
        const data = (await response.json()) as { messages: Message[] };
        if (generation !== fetchGenerationRef.current) {
          return;
        }
        mergeMessagesForBot(botId, data.messages ?? []);
        markMessagesLoaded(botId);
      } catch (error) {
        if (generation !== fetchGenerationRef.current) {
          return;
        }
        setMessagesError(error instanceof Error ? error.message : "알 수 없는 오류");
        markMessagesLoaded(botId);
      } finally {
        if (generation === fetchGenerationRef.current) {
          setMessagesLoadingBotId(null);
        }
      }
    })();

    return () => {
      fetchGenerationRef.current += 1;
    };
  }, [
    botId,
    isCached,
    markMessagesLoaded,
    mergeMessagesForBot,
    setMessagesError,
    setMessagesLoadingBotId,
  ]);
}
