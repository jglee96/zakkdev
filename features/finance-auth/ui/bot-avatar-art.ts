/** Neutral abstract avatar art — one cohesive centered mark per botId; hues from avatar palette. */

export type ColorScheme = "light" | "dark";

export type AvatarShapeRole = "body" | "inner";

export type AvatarShape = {
  kind: "path";
  role: AvatarShapeRole;
  d: string;
  fillRole: "foreground" | "accent" | "background";
  opacity: number;
};

export type BotAvatarArt = {
  background: string;
  foreground: string;
  accent: string;
  innerSoft: string;
  shapes: AvatarShape[];
};

const VIEW_SIZE = 32;
const CENTER = 16;
/** Minimum inset from viewBox edge for body paths (transparent avatar, no tile). */
export const AVATAR_VIEW_PADDING_PX = 1;
const VIEW_MARGIN = AVATAR_VIEW_PADDING_PX;

/** Muted avatar hues — see docs/finance-design-tokens.md */
export type AvatarHueSwatch = {
  id: string;
  light: { canvas: string; body: string; inner: string; innerSoft: string };
  dark: { canvas: string; body: string; inner: string; innerSoft: string };
};

export const AVATAR_HUE_PALETTE: AvatarHueSwatch[] = [
  {
    id: "terracotta",
    light: { canvas: "#f6e8e2", body: "#9e4a2e", inner: "#7a381c", innerSoft: "#d4a894" },
    dark: { canvas: "#221a18", body: "#e89570", inner: "#f4c4a8", innerSoft: "#3d2a24" },
  },
  {
    id: "ochre",
    light: { canvas: "#f4ead8", body: "#8a6528", inner: "#634a18", innerSoft: "#d4c4a4" },
    dark: { canvas: "#211d16", body: "#ddb96a", inner: "#f0d490", innerSoft: "#3a3224" },
  },
  {
    id: "olive",
    light: { canvas: "#ece9df", body: "#545a3e", inner: "#3f4532", innerSoft: "#c4bfb0" },
    dark: { canvas: "#1b1d17", body: "#b0ba8c", inner: "#ccd6a4", innerSoft: "#2e3228" },
  },
  {
    id: "sage",
    light: { canvas: "#e7efe9", body: "#456354", inner: "#314a3e", innerSoft: "#b8c9be" },
    dark: { canvas: "#181c19", body: "#98b8a4", inner: "#b8d4c2", innerSoft: "#28312c" },
  },
  {
    id: "teal",
    light: { canvas: "#e3f0ef", body: "#326562", inner: "#224a48", innerSoft: "#a8c9c6" },
    dark: { canvas: "#161c1c", body: "#78b4b0", inner: "#a8d8d4", innerSoft: "#243230" },
  },
  {
    id: "slate-blue",
    light: { canvas: "#e5ecf2", body: "#3f556a", inner: "#2c3e50", innerSoft: "#b5c4d0" },
    dark: { canvas: "#181b1f", body: "#92aec4", inner: "#bcd2e2", innerSoft: "#2a323a" },
  },
  {
    id: "indigo",
    light: { canvas: "#e8e9f2", body: "#454b72", inner: "#32365a", innerSoft: "#b8bad0" },
    dark: { canvas: "#1a1a22", body: "#a4a8d0", inner: "#c8cce8", innerSoft: "#2c2d3a" },
  },
  {
    id: "plum",
    light: { canvas: "#efe8ec", body: "#62455c", inner: "#463240", innerSoft: "#ccbcc4" },
    dark: { canvas: "#1f1a1d", body: "#c09cb2", inner: "#e0c0d0", innerSoft: "#352a30" },
  },
  {
    id: "rose",
    light: { canvas: "#f5e9eb", body: "#8f4f5d", inner: "#6c3846", innerSoft: "#d4b8bf" },
    dark: { canvas: "#211a1c", body: "#dc94a2", inner: "#f4b8c4", innerSoft: "#3a2a2e" },
  },
  {
    id: "sand",
    light: { canvas: "#f0ebe4", body: "#6a5c4c", inner: "#4e4438", innerSoft: "#ccc4b8" },
    dark: { canvas: "#1d1b18", body: "#c4b4a0", inner: "#e0d4c0", innerSoft: "#322e28" },
  },
  {
    id: "charcoal",
    light: { canvas: "#e8e6e3", body: "#3e3c38", inner: "#2c2a28", innerSoft: "#bcb9b4" },
    dark: { canvas: "#181716", body: "#b4afa8", inner: "#d4cfc8", innerSoft: "#2a2826" },
  },
  {
    id: "braun-rust",
    light: { canvas: "#f3e3dc", body: "#963f24", inner: "#702c16", innerSoft: "#d4b4a6" },
    dark: { canvas: "#221816", body: "#e07c58", inner: "#f4ac90", innerSoft: "#3d2820" },
  },
];

export const AVATAR_PAGE_CANVAS = {
  light: "#f4f1ec",
  dark: "#131110",
} as const;

/** Sidebar active row (`.botSidebarItemActive`) — avatars sit on this in the list. */
export const AVATAR_SIDEBAR_ACTIVE = {
  light: "#fbdbd2",
  dark: "#2a2724",
} as const;

type Point = { x: number; y: number };

export function hashBotId(botId: string): number {
  let h = 2166136261;
  for (let i = 0; i < botId.length; i++) {
    h ^= botId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Spread hue picks across the palette (stable per botId). */
export function pickAvatarHueIndex(botId: string): number {
  const seed = hashBotId(botId);
  const mixed = Math.imul(seed ^ (seed >>> 13), 0x9e3779b1) >>> 0;
  return mixed % AVATAR_HUE_PALETTE.length;
}

function relativeLuminance(hex: string): number {
  const raw = hex.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = toLin(r);
  const G = toLin(g);
  const B = toLin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function resolveAvatarColors(botId: string, scheme: ColorScheme): {
  hueId: string;
  background: string;
  foreground: string;
  accent: string;
  innerSoft: string;
} {
  const hue = AVATAR_HUE_PALETTE[pickAvatarHueIndex(botId)]!;
  const swatch = scheme === "light" ? hue.light : hue.dark;
  return {
    hueId: hue.id,
    background: swatch.canvas,
    foreground: swatch.body,
    accent: swatch.inner,
    innerSoft: swatch.innerSoft,
  };
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function catmullRomClosedPath(points: Point[]): string {
  const n = points.length;
  if (n < 3) return "";
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return `${d} Z`;
}

function blobVertices(rand: () => number, cx: number, cy: number, avgRadius: number, symmetric: boolean): Point[] {
  const segments = 8;
  const half: number[] = [];
  for (let i = 0; i < segments / 2; i++) {
    half.push(avgRadius * (0.92 + rand() * 0.14));
  }
  const radii = symmetric ? [...half, ...half.slice().reverse()] : half.concat(half.map((r) => r * (0.94 + rand() * 0.1)));

  return radii.map((r, i) => {
    const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
}

function pathBounds(d: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const numbers = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
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
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: VIEW_SIZE, maxY: VIEW_SIZE };
  }
  return { minX, minY, maxX, maxY };
}

function boundsWithinViewBox(bounds: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  return (
    bounds.minX >= VIEW_MARGIN - 0.5 &&
    bounds.minY >= VIEW_MARGIN - 0.5 &&
    bounds.maxX <= VIEW_SIZE - VIEW_MARGIN + 0.5 &&
    bounds.maxY <= VIEW_SIZE - VIEW_MARGIN + 0.5
  );
}

function innerContainedInOuter(inner: { minX: number; minY: number; maxX: number; maxY: number }, outer: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}): boolean {
  const pad = 0.35;
  return (
    inner.minX >= outer.minX + pad &&
    inner.minY >= outer.minY + pad &&
    inner.maxX <= outer.maxX - pad &&
    inner.maxY <= outer.maxY - pad
  );
}

export function validateBotAvatarArt(art: BotAvatarArt): {
  withinViewBox: boolean;
  innerContained: boolean;
  hasBody: boolean;
} {
  const body = art.shapes.find((s) => s.role === "body");
  const inner = art.shapes.find((s) => s.role === "inner");
  if (!body) {
    return { withinViewBox: false, innerContained: false, hasBody: false };
  }
  const bodyBounds = pathBounds(body.d);
  const withinViewBox = boundsWithinViewBox(bodyBounds);
  if (!inner) {
    return { withinViewBox, innerContained: true, hasBody: true };
  }
  const innerBounds = pathBounds(inner.d);
  const innerOk = boundsWithinViewBox(innerBounds) && innerContainedInOuter(innerBounds, bodyBounds);
  return { withinViewBox: withinViewBox && boundsWithinViewBox(innerBounds), innerContained: innerOk, hasBody: true };
}

export function generateBotAvatarArt(botId: string, scheme: ColorScheme): BotAvatarArt {
  const seed = hashBotId(botId);
  const rand = mulberry32(seed);

  const { background, foreground, accent, innerSoft } = resolveAvatarColors(botId, scheme);

  // ~1px viewBox padding at 32×32; Catmull-Rom stays inside vertex hull with modest wobble.
  const bodyRadius = 13.88 + (seed % 5) * 0.08;
  const symmetric = seed % 3 !== 0;
  const bodyVerts = blobVertices(rand, CENTER, CENTER, bodyRadius, symmetric);
  const bodyPath = catmullRomClosedPath(bodyVerts);

  const shapes: AvatarShape[] = [
    {
      kind: "path",
      role: "body",
      d: bodyPath,
      fillRole: "foreground",
      opacity: 0.92 + (seed % 7) * 0.01,
    },
  ];

  const includeInner = seed % 5 !== 0;
  if (includeInner) {
    const innerRadius = bodyRadius * (0.38 + rand() * 0.12);
    const innerVerts = blobVertices(rand, CENTER, CENTER, innerRadius, true);
    const innerPath = catmullRomClosedPath(innerVerts);
    const innerFill = seed % 2 === 0 ? "accent" : "background";
    shapes.push({
      kind: "path",
      role: "inner",
      d: innerPath,
      fillRole: innerFill,
      opacity: innerFill === "background" ? 0.85 : 0.78,
    });
  }

  return { background, foreground, accent, innerSoft, shapes };
}

export function renderAvatarSvgMarkup(botId: string, scheme: ColorScheme, size: number): string {
  const art = generateBotAvatarArt(botId, scheme);
  const paths = art.shapes
    .map((shape) => {
      const fill =
        shape.fillRole === "foreground"
          ? art.foreground
          : shape.fillRole === "accent"
            ? art.accent
            : art.innerSoft;
      return `<path d="${shape.d}" fill="${fill}" opacity="${shape.opacity}" />`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${paths}</svg>`;
}
