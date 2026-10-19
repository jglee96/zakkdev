import assert from "node:assert/strict";
import { test } from "node:test";
import { useFinanceStore } from "../../features/finance-auth/store/finance-store";
import { MAIN_BOT_ID } from "../../shared/finance/constants";

test("hydrateFromServer seeds bots, lists, and active bot messages once", () => {
  useFinanceStore.getState().reset();

  useFinanceStore.getState().hydrateFromServer({
    activeBotId: MAIN_BOT_ID,
    bots: [
      {
        id: "bot-1",
        name: "메인 봇",
        template: "main",
        status: "active",
        allowedTools: [],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    routines: [
      {
        id: "routine-1",
        botId: "bot-1",
        name: "Daily",
        instruction: "analyze",
        cronExpr: "0 9 * * *",
        timezone: "Asia/Seoul",
        status: "active",
        version: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    runs: [
      {
        id: "run-1",
        botId: "bot-1",
        status: "completed",
        attempt: 1,
        maxAttempts: 3,
        createdAt: 1,
      },
    ],
    activeBotMessages: [
      {
        id: "msg-1",
        botId: MAIN_BOT_ID,
        role: "user",
        content: "hello",
        createdAt: 2,
      },
    ],
  });

  const state = useFinanceStore.getState();
  assert.equal(state.bots.length, 1);
  assert.equal(state.routines.length, 1);
  assert.equal(state.runs.length, 1);
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0]?.content, "hello");
  assert.equal(state.messagesLoadedBotIds[MAIN_BOT_ID], true);
  assert.equal(state.isLoadingBots, false);
});
