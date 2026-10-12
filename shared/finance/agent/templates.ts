import "server-only";
import type { BotTemplate } from "./types";

export type TemplateDefinition = {
  readonly name: string;
  readonly description: string;
  readonly defaultInstructions: string;
  readonly allowedTools: readonly string[];
  readonly requiredTools: readonly string[];
};

export const MAIN_BOT_TOOLS = [
  "create_bot",
  "list_bots",
  "update_bot",
  "invoke_bot",
  "list_reports",
] as const;

export const KR_STOCK_TOOLS = [
  "search_dart_filings",
  "get_filing_detail",
  "get_financials",
  "find_relevant_theses",
  "save_insight",
] as const;

export const US_STOCK_TOOLS = [
  "search_sec_filings",
  "get_filing_detail",
  "find_relevant_theses",
  "save_insight",
] as const;

export const INDEX_FUTURES_TOOLS = [
  "find_relevant_theses",
  "save_insight",
] as const;

export const TEMPLATE_DEFINITIONS: Record<BotTemplate, TemplateDefinition> = {
  main: {
    name: "Main Financial Bot",
    description: "금융 분석 봇을 생성하고 관리하는 메인 봇입니다.",
    defaultInstructions: `당신은 금융 분석을 도와주는 메인 봇입니다.
사용자의 요청에 따라 전문 봇을 생성하고, 기존 봇과 대화하거나, 분석 보고서를 조회할 수 있습니다.
항상 한국어로 응답하세요.
봇을 생성할 때는 사용자의 의도를 파악하여 적절한 템플릿과 이름을 선택하세요.`,
    allowedTools: MAIN_BOT_TOOLS,
    requiredTools: ["create_bot", "list_bots"],
  },
  "kr-stock": {
    name: "한국 주식 분석 봇",
    description: "OpenDART 공시와 재무제표를 분석하는 한국 주식 전문 봇입니다.",
    defaultInstructions: `당신은 한국 주식 공시와 재무제표를 분석하는 전문 봇입니다.
OpenDART에서 공시를 검색하고, 재무제표를 분석하며, 투자 가설을 검증합니다.
모든 분석에는 반드시 원문 공시의 접수번호, URL, 접수일자를 포함하세요.
정확한 발표 시각이 없는 경우 날짜 정밀도로 표시하고, 추정하지 마세요.
항상 한국어로 응답하세요.`,
    allowedTools: KR_STOCK_TOOLS,
    requiredTools: ["search_dart_filings", "find_relevant_theses"],
  },
  "us-stock": {
    name: "미국 주식 분석 봇",
    description: "SEC EDGAR 공시를 분석하는 미국 주식 전문 봇입니다.",
    defaultInstructions: `당신은 미국 주식 SEC 공시를 분석하는 전문 봇입니다.
SEC EDGAR에서 공시를 검색하고, 투자 가설을 검증합니다.
모든 분석에는 반드시 공시의 Accession Number와 Filing URL을 포함하세요.
항상 한국어로 응답하세요.`,
    allowedTools: US_STOCK_TOOLS,
    requiredTools: ["find_relevant_theses"],
  },
  "index-futures": {
    name: "지수 선물 분석 봇",
    description: "지수 선물 시장을 분석하는 전문 봇입니다. (데이터 연동 준비 중)",
    defaultInstructions: `당신은 지수 선물 시장을 분석하는 전문 봇입니다.
현재 실시간 데이터 연동은 준비 중이며, 투자 가설 관리 기능만 제공됩니다.
실제 거래 추천이나 레버리지 전략은 제공하지 않습니다.
항상 한국어로 응답하세요.`,
    allowedTools: INDEX_FUTURES_TOOLS,
    requiredTools: [],
  },
};

export function getTemplateDefinition(template: BotTemplate): TemplateDefinition {
  return TEMPLATE_DEFINITIONS[template];
}

export function isValidTemplate(template: string): template is BotTemplate {
  return template in TEMPLATE_DEFINITIONS;
}

export function validateAllowedTools(template: BotTemplate, tools: string[]): {
  valid: boolean;
  invalidTools: string[];
  missingRequired: string[];
} {
  const definition = TEMPLATE_DEFINITIONS[template];
  const allowedSet = new Set(definition.allowedTools);
  const requiredSet = new Set(definition.requiredTools);
  const toolSet = new Set(tools);

  const invalidTools = tools.filter((t) => !allowedSet.has(t));
  const missingRequired = definition.requiredTools.filter((t) => !toolSet.has(t));

  return {
    valid: invalidTools.length === 0 && missingRequired.length === 0,
    invalidTools,
    missingRequired,
  };
}

export function getDefaultTools(template: BotTemplate): string[] {
  return [...TEMPLATE_DEFINITIONS[template].allowedTools];
}
