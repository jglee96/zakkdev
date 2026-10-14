import assert from "node:assert/strict";
import { test } from "node:test";
import { MAIN_BOT_ID } from "../../shared/finance/constants";
import { getActiveBotDisplayMeta } from "../../features/finance-auth/ui/bot-template-meta";
import type { Bot } from "../../features/finance-auth/store/finance-store";

const specialist: Bot = {
  id: "bot-kr-stock",
  name: "한국 주식 분석봇",
  template: "kr-stock",
  status: "active",
  allowedTools: [],
  createdAt: 0,
  updatedAt: 0,
};

test("getActiveBotDisplayMeta resolves main bot without specialists", () => {
  const meta = getActiveBotDisplayMeta([], null);
  assert.equal(meta.name, "메인 봇");
  assert.equal(meta.roleLine, "종합 오케스트레이션");
});

test("getActiveBotDisplayMeta resolves selected specialist", () => {
  const meta = getActiveBotDisplayMeta([specialist], specialist.id);
  assert.equal(meta.name, "한국 주식 분석봇");
  assert.ok(meta.roleLine.includes("DART"));
});

test("getActiveBotDisplayMeta falls back when bot id missing", () => {
  const meta = getActiveBotDisplayMeta([], "missing-bot");
  assert.equal(meta.name, "메인 봇");
});

test("MAIN_BOT_ID is stable across shared and UI", () => {
  assert.equal(MAIN_BOT_ID, "main-bot");
});
