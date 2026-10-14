import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateBotAvatarArt,
  validateBotAvatarArt,
} from "../../features/finance-auth/ui/bot-avatar-art";

const SAMPLE_BOT_IDS = [
  "main-bot",
  "bot-kr-stock",
  "bot-us-stock",
  "bot-index-futures",
  "bot-alpha-01",
  "bot-beta-02",
  "bot-gamma-03",
  "bot-delta-04",
  "bot-epsilon-05",
  "bot-zeta-06",
  "bot-eta-07",
  "bot-theta-08",
];

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
  assert.equal(light.shapes.length, dark.shapes.length);
  assert.ok(light.shapes.length >= 1 && light.shapes.length <= 2);
});

test("bot avatar art uses cohesive path layers within viewBox", () => {
  for (const botId of SAMPLE_BOT_IDS) {
    for (const scheme of ["light", "dark"] as const) {
      const art = generateBotAvatarArt(botId, scheme);
      assert.equal(art.shapes[0]?.kind, "path");
      assert.equal(art.shapes[0]?.role, "body");
      for (const shape of art.shapes) {
        assert.equal(shape.kind, "path");
        assert.ok(shape.d.includes("Z"), `${botId}/${scheme}: closed path`);
      }
      const validation = validateBotAvatarArt(art);
      assert.ok(validation.hasBody, botId);
      assert.ok(validation.withinViewBox, `${botId}/${scheme}: within viewBox`);
      assert.ok(validation.innerContained, `${botId}/${scheme}: inner contained`);
    }
  }
});
