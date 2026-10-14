import type { Message } from "../store/finance-store";

/** Merge server messages for one bot with in-memory state (keeps optimistic local-* rows). */
export function mergeBotMessages(
  existing: Message[],
  botId: string,
  fromServer: Message[],
): Message[] {
  const others = existing.filter((m) => m.botId !== botId);
  const localOnly = existing.filter(
    (m) => m.botId === botId && m.id.startsWith("local-"),
  );
  const serverIds = new Set(fromServer.map((m) => m.id));
  const pendingLocal = localOnly.filter((m) => !serverIds.has(m.id));
  const mergedForBot = [...fromServer, ...pendingLocal].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  return [...others, ...mergedForBot];
}
