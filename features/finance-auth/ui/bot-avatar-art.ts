/** Neutral abstract avatar art — deterministic from botId, design-token palette only. */

export type ColorScheme = "light" | "dark";

export type AvatarShape =
  | { kind: "circle"; cx: number; cy: number; r: number; opacity: number }
  | { kind: "ring"; cx: number; cy: number; r: number; stroke: number; opacity: number }
  | { kind: "blob"; points: string; opacity: number }
  | { kind: "roundedPoly"; points: string; rx: number; opacity: number };

export type BotAvatarArt = {
  background: string;
  foreground: string;
  accent: string;
  shapes: AvatarShape[];
};

const LIGHT_BACKGROUNDS = ["#fdfcf9", "#f4f1ec", "#fbdbd2", "#e8e3db", "#f4f1ec"];
const LIGHT_FOREGROUNDS = ["#c74219", "#5e5a56", "#a83614", "#882b10", "#9e9890"];
const LIGHT_ACCENTS = ["#df5f3a", "#dad4ca", "#c74219", "#5e5a56"];

const DARK_BACKGROUNDS = ["#131110", "#1c1917", "#2a2724", "#1c1917", "#131110"];
const DARK_FOREGROUNDS = ["#c74219", "#8a8480", "#ede9e3", "#df5f3a", "#b5afa4"];
const DARK_ACCENTS = ["#882b10", "#5e5a56", "#a83614", "#8a8480"];

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

export function generateBotAvatarArt(botId: string, scheme: ColorScheme): BotAvatarArt {
  const seed = hashBotId(botId);
  const rand = mulberry32(seed);

  const backgrounds = scheme === "light" ? LIGHT_BACKGROUNDS : DARK_BACKGROUNDS;
  const foregrounds = scheme === "light" ? LIGHT_FOREGROUNDS : DARK_FOREGROUNDS;
  const accents = scheme === "light" ? LIGHT_ACCENTS : DARK_ACCENTS;

  const background = backgrounds[seed % backgrounds.length]!;
  const foreground = foregrounds[(seed >>> 3) % foregrounds.length]!;
  const accent = accents[(seed >>> 7) % accents.length]!;

  const shapeCount = 2 + (seed % 3);
  const shapes: AvatarShape[] = [];
  const kinds = ["circle", "ring", "blob", "roundedPoly"] as const;

  for (let i = 0; i < shapeCount; i++) {
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const opacity = 0.28 + rand() * 0.55;
    const cx = 6 + rand() * 20;
    const cy = 6 + rand() * 20;
    const r = 3 + rand() * 9;

    switch (kind) {
      case "circle":
        shapes.push({ kind: "circle", cx, cy, r, opacity });
        break;
      case "ring":
        shapes.push({ kind: "ring", cx, cy, r, stroke: 1.2 + rand() * 1.8, opacity });
        break;
      case "blob": {
        const n = 5 + Math.floor(rand() * 3);
        const pts: string[] = [];
        for (let v = 0; v < n; v++) {
          const angle = (v / n) * Math.PI * 2;
          const wobble = 0.65 + rand() * 0.45;
          const px = 16 + Math.cos(angle) * 10 * wobble;
          const py = 16 + Math.sin(angle) * 10 * wobble;
          pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        }
        shapes.push({ kind: "blob", points: pts.join(" "), opacity });
        break;
      }
      case "roundedPoly": {
        const x = 4 + rand() * 10;
        const y = 4 + rand() * 10;
        const w = 8 + rand() * 14;
        const h = 8 + rand() * 14;
        shapes.push({
          kind: "roundedPoly",
          points: `${x},${y} ${x + w},${y + 4} ${x + w - 2},${y + h} ${x + 2},${y + h - 2}`,
          rx: 3 + rand() * 4,
          opacity,
        });
        break;
      }
      default: {
        const never: never = kind;
        throw new Error(`Unhandled shape: ${never}`);
      }
    }
  }

  return { background, foreground, accent, shapes };
}
