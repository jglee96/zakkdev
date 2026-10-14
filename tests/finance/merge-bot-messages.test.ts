import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeBotMessages } from "../../features/finance-auth/lib/merge-bot-messages";
import type { Message } from "../../features/finance-auth/store/finance-store";

const base = (overrides: Partial<Message>): Message => ({
  id: "id-1",
  botId: "bot-a",
  role: "user",
  content: "hi",
  createdAt: 1,
  ...overrides,
});

test("mergeBotMessages replaces server-backed rows but keeps optimistic local-* messages", () => {
  const existing: Message[] = [
    base({ id: "local-1", content: "pending" }),
    base({ id: "old-server", content: "stale" }),
    base({ id: "other-bot", botId: "bot-b" }),
  ];
  const fromServer: Message[] = [base({ id: "srv-1", content: "from api", createdAt: 2 })];

  const merged = mergeBotMessages(existing, "bot-a", fromServer);
  assert.equal(merged.length, 3);
  assert.ok(merged.some((m) => m.id === "srv-1"));
  assert.ok(merged.some((m) => m.id === "local-1"));
  assert.ok(merged.some((m) => m.id === "other-bot"));
  assert.ok(!merged.some((m) => m.id === "old-server"));
});
