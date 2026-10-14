/** Neutral abstract avatar art — one cohesive centered mark per botId, design-token palette only. */

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
  shapes: AvatarShape[];
};

const VIEW_SIZE = 32;
const CENTER = 16;
const VIEW_MARGIN = 3;

const LIGHT_BACKGROUNDS = ["#fdfcf9", "#f4f1ec", "#fbdbd2", "#e8e3db", "#f4f1ec"];
const LIGHT_FOREGROUNDS = ["#c74219", "#5e5a56", "#a83614", "#882b10", "#9e9890"];
const LIGHT_ACCENTS = ["#df5f3a", "#dad4ca", "#c74219", "#5e5a56"];

const DARK_BACKGROUNDS = ["#131110", "#1c1917", "#2a2724", "#1c1917", "#131110"];
const DARK_FOREGROUNDS = ["#c74219", "#8a8480", "#ede9e3", "#df5f3a", "#b5afa4"];
const DARK_ACCENTS = ["#882b10", "#5e5a56", "#a83614", "#8a8480"];

type Point = { x: number; y: number };

function hashBotId(botId: string): number {
  let h = 2166136261;
  for (let i = 0; i < botId.length; i++) {
    h ^= botId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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

  const backgrounds = scheme === "light" ? LIGHT_BACKGROUNDS : DARK_BACKGROUNDS;
  const foregrounds = scheme === "light" ? LIGHT_FOREGROUNDS : DARK_FOREGROUNDS;
  const accents = scheme === "light" ? LIGHT_ACCENTS : DARK_ACCENTS;

  const background = backgrounds[seed % backgrounds.length]!;
  const foreground = foregrounds[(seed >>> 3) % foregrounds.length]!;
  const accent = accents[(seed >>> 7) % accents.length]!;

  const bodyRadius = 9.2 + (seed % 5) * 0.35;
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
      opacity: innerFill === "background" ? 0.55 : 0.72,
    });
  }

  return { background, foreground, accent, shapes };
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
            : art.background;
      return `<path d="${shape.d}" fill="${fill}" opacity="${shape.opacity}" />`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32" fill="${art.background}" />${paths}</svg>`;
}
