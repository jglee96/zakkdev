"use client";

import { Box } from "@mantine/core";
import { useComputedColorScheme } from "@mantine/core";
import { generateBotAvatarArt, type AvatarShape } from "./bot-avatar-art";

export function BotAvatar({ botId, size = 36 }: { botId: string; size?: number }) {
  const scheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = scheme === "dark";
  const art = generateBotAvatarArt(botId, isDark ? "dark" : "light");

  return (
    <Box
      component="span"
      data-testid={`bot-avatar-${botId}`}
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 4,
        border: `1px solid ${isDark ? "#2a2724" : "#ddd8d2"}`,
        overflow: "hidden",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        role="img"
        aria-hidden
        style={{ display: "block" }}
      >
        <rect width="32" height="32" fill={art.background} />
        {art.shapes.map((shape, index) => renderShape(shape, art, index))}
      </svg>
    </Box>
  );
}

function renderShape(shape: AvatarShape, art: ReturnType<typeof generateBotAvatarArt>, index: number) {
  const fill =
    shape.fillRole === "foreground"
      ? art.foreground
      : shape.fillRole === "accent"
        ? art.accent
        : art.background;

  return <path key={`${shape.role}-${index}`} d={shape.d} fill={fill} opacity={shape.opacity} />;
}
