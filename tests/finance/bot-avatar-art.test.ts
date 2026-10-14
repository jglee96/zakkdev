import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AVATAR_HUE_PALETTE,
  AVATAR_PAGE_CANVAS,
  contrastRatio,
  generateBotAvatarArt,
  pickAvatarHueIndex,
  resolveAvatarColors,
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
  assert.notEqual(pickAvatarHueIndex("main-bot"), pickAvatarHueIndex("bot-kr-stock"));
});

test("bot avatar art varies by color scheme using dedicated hue swatches", () => {
  const light = generateBotAvatarArt("main-bot", "light");
  const dark = generateBotAvatarArt("main-bot", "dark");
  assert.notEqual(light.background, dark.background);
  assert.notEqual(light.foreground, dark.foreground);
  assert.equal(light.shapes.length, dark.shapes.length);
  assert.ok(light.shapes.length >= 1 && light.shapes.length <= 2);
  assert.equal(light.shapes[0]?.d, dark.shapes[0]?.d, "shape paths match across schemes");
});

test("avatar palette assigns diverse hues to sample bot ids", () => {
  const hueIndexes = SAMPLE_BOT_IDS.map((id) => pickAvatarHueIndex(id));
  const unique = new Set(hueIndexes);
  assert.ok(unique.size >= 6, `expected diverse hues, got ${unique.size}`);
  assert.notEqual(
    resolveAvatarColors("main-bot", "light").foreground,
    resolveAvatarColors("bot-kr-stock", "light").foreground,
  );
  assert.equal(AVATAR_HUE_PALETTE.length, 12);
});

test("avatar colors meet contrast on canvas and page backgrounds", () => {
  for (const botId of SAMPLE_BOT_IDS) {
    for (const scheme of ["light", "dark"] as const) {
      const colors = resolveAvatarColors(botId, scheme);
      const pageBg = AVATAR_PAGE_CANVAS[scheme];
      assert.ok(
        contrastRatio(colors.foreground, colors.background) >= 3,
        `${botId}/${scheme}: body vs canvas`,
      );
      assert.ok(
        contrastRatio(colors.foreground, pageBg) >= 2.8,
        `${botId}/${scheme}: body vs page`,
      );
      assert.ok(
        contrastRatio(colors.accent, colors.foreground) >= 1.05 ||
          contrastRatio(colors.innerSoft, colors.foreground) >= 1.05,
        `${botId}/${scheme}: inner tones vs body`,
      );
    }
  }
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
