import "server-only";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { BotTemplate } from "./types";
import { TEMPLATE_DEFINITIONS } from "./templates";

export type ToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly requiresAuth: boolean;
  readonly mutates: boolean;
};

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  create_bot: {
    name: "create_bot",
    description: "새로운 전문 봇을 생성합니다. template은 kr-stock, us-stock, index-futures 중 하나입니다.",
    parameters: {
      type: "object",
      properties: {
        template: {
          type: "string",
          enum: ["kr-stock", "us-stock", "index-futures"],
          description: "봇 템플릿: kr-stock(한국 주식), us-stock(미국 주식), index-futures(지수 선물)",
        },
        name: {
          type: "string",
          description: "봇의 이름 (예: '삼성전자 공시 분석 봇')",
        },
        instructions: {
          type: "string",
          description: "봇에게 추가로 주는 지시사항 (선택)",
        },
      },
      required: ["template", "name"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: true,
  },
  list_bots: {
    name: "list_bots",
    description: "소유한 봇 목록을 조회합니다.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "paused", "archived", "all"],
          description: "필터링할 봇 상태 (기본: active)",
        },
      },
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: false,
  },
  update_bot: {
    name: "update_bot",
    description: "봇의 설정을 수정합니다.",
    parameters: {
      type: "object",
      properties: {
        botId: {
          type: "string",
          description: "수정할 봇의 ID",
        },
        name: {
          type: "string",
          description: "새 이름 (선택)",
        },
        instructions: {
          type: "string",
          description: "새 지시사항 (선택)",
        },
        status: {
          type: "string",
          enum: ["active", "paused", "archived"],
          description: "새 상태 (선택)",
        },
      },
      required: ["botId"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: true,
  },
  invoke_bot: {
    name: "invoke_bot",
    description: "다른 봇에게 질문을 전달하고 응답을 받습니다.",
    parameters: {
      type: "object",
      properties: {
        botId: {
          type: "string",
          description: "호출할 봇의 ID",
        },
        message: {
          type: "string",
          description: "봇에게 전달할 메시지",
        },
      },
      required: ["botId", "message"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: true,
  },
  list_reports: {
    name: "list_reports",
    description: "저장된 분석 보고서 목록을 조회합니다.",
    parameters: {
      type: "object",
      properties: {
        botId: {
          type: "string",
          description: "특정 봇의 보고서만 조회 (선택)",
        },
        limit: {
          type: "integer",
          description: "최대 조회 개수 (기본: 10)",
          minimum: 1,
          maximum: 50,
        },
      },
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: false,
  },
  search_dart_filings: {
    name: "search_dart_filings",
    description: "OpenDART에서 공시를 검색합니다.",
    parameters: {
      type: "object",
      properties: {
        corpName: {
          type: "string",
          description: "기업명 또는 종목코드",
        },
        startDate: {
          type: "string",
          description: "검색 시작일 (YYYYMMDD)",
        },
        endDate: {
          type: "string",
          description: "검색 종료일 (YYYYMMDD)",
        },
        filingType: {
          type: "string",
          description: "공시 유형 필터 (선택)",
        },
      },
      required: ["corpName"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: false,
  },
  get_filing_detail: {
    name: "get_filing_detail",
    description: "공시 상세 내용을 조회합니다.",
    parameters: {
      type: "object",
      properties: {
        receiptNo: {
          type: "string",
          description: "공시 접수번호",
        },
      },
      required: ["receiptNo"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: false,
  },
  get_financials: {
    name: "get_financials",
    description: "기업의 재무제표를 조회합니다.",
    parameters: {
      type: "object",
      properties: {
        corpCode: {
          type: "string",
          description: "기업 고유번호",
        },
        year: {
          type: "string",
          description: "사업연도 (YYYY)",
        },
        reportCode: {
          type: "string",
          enum: ["11013", "11012", "11014", "11011"],
          description: "보고서 코드: 11013(1분기), 11012(반기), 11014(3분기), 11011(사업보고서)",
        },
      },
      required: ["corpCode", "year", "reportCode"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: false,
  },
  search_sec_filings: {
    name: "search_sec_filings",
    description: "SEC EDGAR에서 공시를 검색합니다.",
    parameters: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description: "티커 심볼 (예: AAPL)",
        },
        formType: {
          type: "string",
          description: "Form 유형 (예: 10-K, 10-Q, 8-K)",
        },
        startDate: {
          type: "string",
          description: "검색 시작일 (YYYY-MM-DD)",
        },
      },
      required: ["ticker"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: false,
  },
  find_relevant_theses: {
    name: "find_relevant_theses",
    description: "관련 투자 가설을 검색합니다.",
    parameters: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "주제 (기업명, 티커 등)",
        },
        status: {
          type: "string",
          enum: ["active", "supported", "contradicted", "neutral", "all"],
          description: "가설 상태 필터 (기본: all)",
        },
      },
      required: ["subject"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: false,
  },
  save_insight: {
    name: "save_insight",
    description: "새로운 투자 인사이트나 가설을 저장합니다.",
    parameters: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "주제 (기업명, 티커 등)",
        },
        thesis: {
          type: "string",
          description: "투자 가설 또는 인사이트 내용",
        },
        evidence: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sourceType: { type: "string", description: "출처 유형" },
              sourceId: { type: "string", description: "출처 ID" },
              sourceUrl: { type: "string", description: "출처 URL" },
              summary: { type: "string", description: "요약" },
            },
            required: ["sourceType", "sourceId", "summary"],
          },
          description: "근거 자료 목록",
        },
        status: {
          type: "string",
          enum: ["active", "supported", "contradicted", "neutral"],
          description: "가설 상태",
        },
      },
      required: ["subject", "thesis", "evidence", "status"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: true,
  },
  create_routine: {
    name: "create_routine",
    description: "봇의 정기 실행 루틴을 생성합니다. 지정된 일정에 따라 봇이 자동으로 실행됩니다.",
    parameters: {
      type: "object",
      properties: {
        botId: {
          type: "string",
          description: "실행할 봇의 ID",
        },
        name: {
          type: "string",
          description: "루틴 이름 (예: '매일 아침 시장 분석')",
        },
        instruction: {
          type: "string",
          description: "봇에게 전달할 지시사항",
        },
        cronExpr: {
          type: "string",
          description: "Cron 표현식 (5필드): '분 시 일 월 요일' (예: '0 9 * * 1-5'는 평일 오전 9시)",
        },
        timezone: {
          type: "string",
          enum: ["Asia/Seoul", "America/New_York", "Europe/London", "Asia/Tokyo", "UTC"],
          description: "시간대 (기본: Asia/Seoul)",
        },
      },
      required: ["botId", "name", "instruction", "cronExpr"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: true,
  },
  list_routines: {
    name: "list_routines",
    description: "등록된 루틴 목록을 조회합니다.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "active", "paused", "deleted", "all"],
          description: "필터링할 루틴 상태 (기본: all)",
        },
        botId: {
          type: "string",
          description: "특정 봇의 루틴만 조회 (선택)",
        },
      },
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: false,
  },
  pause_routine: {
    name: "pause_routine",
    description: "실행 중인 루틴을 일시정지합니다.",
    parameters: {
      type: "object",
      properties: {
        routineId: {
          type: "string",
          description: "일시정지할 루틴의 ID",
        },
      },
      required: ["routineId"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: true,
  },
  resume_routine: {
    name: "resume_routine",
    description: "일시정지된 루틴을 재개합니다.",
    parameters: {
      type: "object",
      properties: {
        routineId: {
          type: "string",
          description: "재개할 루틴의 ID",
        },
      },
      required: ["routineId"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: true,
  },
  delete_routine: {
    name: "delete_routine",
    description: "루틴을 삭제합니다. 삭제된 루틴은 더 이상 실행되지 않습니다.",
    parameters: {
      type: "object",
      properties: {
        routineId: {
          type: "string",
          description: "삭제할 루틴의 ID",
        },
      },
      required: ["routineId"],
      additionalProperties: false,
    },
    requiresAuth: true,
    mutates: true,
  },
};

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS[name];
}

export function getToolsForTemplate(template: BotTemplate): ChatCompletionTool[] {
  const templateDef = TEMPLATE_DEFINITIONS[template];
  return templateDef.allowedTools
    .map((name) => TOOL_DEFINITIONS[name])
    .filter((def): def is ToolDefinition => def !== undefined)
    .map((def) => ({
      type: "function" as const,
      function: {
        name: def.name,
        description: def.description,
        parameters: def.parameters,
      },
    }));
}

export function getToolsForBot(allowedTools: readonly string[]): ChatCompletionTool[] {
  return allowedTools
    .map((name) => TOOL_DEFINITIONS[name])
    .filter((def): def is ToolDefinition => def !== undefined)
    .map((def) => ({
      type: "function" as const,
      function: {
        name: def.name,
        description: def.description,
        parameters: def.parameters,
      },
    }));
}

export function isToolAllowed(toolName: string, allowedTools: readonly string[]): boolean {
  return allowedTools.includes(toolName);
}

export function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
