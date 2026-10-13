import assert from "node:assert/strict";
import { test } from "node:test";
import { generateBotAvatarArt } from "../../features/finance-auth/ui/bot-avatar-art";

test("bot avatar art is deterministic per bot id", () => {
  const a = generateBotAvatarArt("bot-kr-stock", "light");
  const b = generateBotAvatarArt("bot-kr-stock", "light");
  assert.deepEqual(a, b);
  const c = generateBotAvatarArt("bot-us-stock", "light");
  assert.notDeepEqual(a.background, c.background);
});

test("bot avatar art varies by color scheme using token palettes", () => {
  const light = generateBotAvatarArt("main-bot", "light");
  const dark = generateBotAvatarArt("main-bot", "dark");
  assert.notEqual(light.background, dark.background);
  assert.ok(light.shapes.length >= 2);
  assert.ok(dark.shapes.length >= 2);
});
