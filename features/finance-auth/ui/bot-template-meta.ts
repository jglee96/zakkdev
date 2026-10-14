import type { Bot, BotTemplate } from "../store/finance-store";
import {
  IconChartLine,
  IconGlobe,
  IconRobot,
  IconSparkles,
  type TablerIcon,
} from "@tabler/icons-react";

import { MAIN_BOT_ID } from "../constants";

export { MAIN_BOT_ID };

export type BotTemplateMeta = {
  template: BotTemplate | "main";
  label: string;
  roleLine: string;
  description: string;
  color: string;
  glyph: string;
  Icon: TablerIcon;
};

export const BOT_TEMPLATE_CATALOG: BotTemplateMeta[] = [
  {
    template: "main",
    label: "메인 봇",
    roleLine: "종합 오케스트레이션",
    description: "여러 전문 봇을 만들고 조율하며, 공시·시장 질문의 시작점입니다.",
    color: "#c74219",
    glyph: "M",
    Icon: IconSparkles,
  },
  {
    template: "kr-stock",
    label: "한국 주식",
    roleLine: "DART · 국내 공시",
    description: "한국 상장사 공시, 재무, DART 원문 링크 분석에 특화됩니다.",
    color: "#a83614",
    glyph: "KR",
    Icon: IconChartLine,
  },
  {
    template: "us-stock",
    label: "미국 주식",
    roleLine: "해외 시장 · 실적",
    description: "미국 종목 실적, 뉴스, 섹터 동향을 중심으로 분석합니다.",
    color: "#5e5a56",
    glyph: "US",
    Icon: IconGlobe,
  },
  {
    template: "index-futures",
    label: "지수·선물",
    roleLine: "파생 · 매크로",
    description: "지수·선물 포지션과 매크로 이벤트에 맞춘 인사이트를 제공합니다.",
    color: "#882b10",
    glyph: "F",
    Icon: IconRobot,
  },
];

export function getTemplateMeta(template: BotTemplate | "main"): BotTemplateMeta {
  return BOT_TEMPLATE_CATALOG.find((t) => t.template === template) ?? BOT_TEMPLATE_CATALOG[0];
}

export function getBotDisplayMeta(bot: { id: string; name: string; template: BotTemplate }) {
  if (bot.id === MAIN_BOT_ID || bot.template === "main") {
    return { ...getTemplateMeta("main"), name: bot.name || "메인 봇" };
  }
  const meta = getTemplateMeta(bot.template);
  return { ...meta, name: bot.name };
}

export function getActiveBotDisplayMeta(bots: Bot[], selectedBotId: string | null) {
  const activeBotId = selectedBotId || MAIN_BOT_ID;
  const activeBot =
    activeBotId === MAIN_BOT_ID
      ? { id: MAIN_BOT_ID, name: "메인 봇", template: "main" as const }
      : bots.find((b) => b.id === activeBotId);
  return activeBot
    ? getBotDisplayMeta(activeBot)
    : getBotDisplayMeta({ id: MAIN_BOT_ID, name: "메인 봇", template: "kr-stock" });
}
