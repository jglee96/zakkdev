import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AVATAR_HUE_PALETTE,
  AVATAR_PAGE_CANVAS,
  AVATAR_SIDEBAR_ACTIVE,
  AVATAR_VIEW_PADDING_PX,
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

test("avatar body meets contrast on page and sidebar active surfaces", () => {
  for (const botId of SAMPLE_BOT_IDS) {
    for (const scheme of ["light", "dark"] as const) {
      const colors = resolveAvatarColors(botId, scheme);
      const pageBg = AVATAR_PAGE_CANVAS[scheme];
      const sidebarBg = AVATAR_SIDEBAR_ACTIVE[scheme];
      assert.ok(
        contrastRatio(colors.foreground, pageBg) >= 3,
        `${botId}/${scheme}: body vs page (${pageBg})`,
      );
      assert.ok(
        contrastRatio(colors.foreground, sidebarBg) >= 2.5,
        `${botId}/${scheme}: body vs sidebar active (${sidebarBg})`,
      );
      assert.ok(
        contrastRatio(colors.accent, colors.foreground) >= 1.05 ||
          contrastRatio(colors.innerSoft, colors.foreground) >= 1.05,
        `${botId}/${scheme}: inner tones vs body`,
      );
    }
  }
});

test("avatar body fills viewBox with minimal padding", () => {
  const viewSize = 32;
  const pad = AVATAR_VIEW_PADDING_PX;
  const tolerance = 0.65;
  const minSpan = viewSize - 2 * pad - 2.75;

  for (const botId of SAMPLE_BOT_IDS) {
    for (const scheme of ["light", "dark"] as const) {
      const art = generateBotAvatarArt(botId, scheme);
      const body = art.shapes.find((s) => s.role === "body");
      assert.ok(body, `${botId}/${scheme}: body path`);
      const numbers = body.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        const x = numbers[i];
        const y = numbers[i + 1];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      assert.ok(minX >= pad - tolerance, `${botId}/${scheme}: minX ${minX}`);
      assert.ok(minY >= pad - tolerance, `${botId}/${scheme}: minY ${minY}`);
      assert.ok(maxX <= viewSize - pad + tolerance, `${botId}/${scheme}: maxX ${maxX}`);
      assert.ok(maxY <= viewSize - pad + tolerance, `${botId}/${scheme}: maxY ${maxY}`);
      assert.ok(maxX - minX >= minSpan, `${botId}/${scheme}: width ${maxX - minX}`);
      assert.ok(maxY - minY >= minSpan, `${botId}/${scheme}: height ${maxY - minY}`);
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
