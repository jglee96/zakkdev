import assert from "node:assert/strict";
import { test } from "node:test";
import { toFinanceBot, toFinanceMessage } from "../../shared/finance/shell/serializers";

test("toFinanceBot clones allowedTools for JSON-safe DTOs", () => {
  const bot = toFinanceBot({
    id: "b1",
    ownerId: "o",
    name: "Test",
    template: "main",
    status: "active",
    allowedTools: ["a"],
    instructions: "x",
    createdAt: 1,
    updatedAt: 2,
  });
  assert.deepEqual(bot.allowedTools, ["a"]);
  bot.allowedTools.push("b");
  assert.deepEqual(bot.allowedTools, ["a", "b"]);
});

test("toFinanceMessage maps storage bot id to UI bot id", () => {
  const msg = toFinanceMessage(
    {
      id: "m1",
      ownerId: "o",
      botId: "storage-uuid",
      role: "user",
      content: "hi",
      createdAt: 3,
    },
    "main-bot",
  );
  assert.equal(msg.botId, "main-bot");
});
