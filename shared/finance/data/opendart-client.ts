import "server-only";
import {
  type Filing,
  type FilingDetail,
  type Financials,
  type FinancialItem,
  parsePublishedDate,
  formatFilingUrl,
  isCorrection,
  extractPriorReceiptNo,
} from "./types";

export type OpenDartConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
};

export class OpenDartError extends Error {
  constructor(
    message: string,
    public readonly code: "config_error" | "api_error" | "timeout" | "parse_error" | "not_found"
  ) {
    super(message);
  }
}

export function createOpenDartConfig(env: Partial<NodeJS.ProcessEnv> = process.env): OpenDartConfig {
  const apiKey = env.OPENDART_API_KEY;
  if (!apiKey) {
    throw new OpenDartError("OPENDART_API_KEY is not configured", "config_error");
  }

  return {
    apiKey,
    baseUrl: env.OPENDART_BASE_URL || "https://opendart.fss.or.kr/api",
    timeoutMs: Number(env.OPENDART_TIMEOUT_MS) || 10000,
  };
}

export type SearchFilingsParams = {
  corpName?: string;
  corpCode?: string;
  startDate?: string;
  endDate?: string;
  filingType?: string;
  pageNo?: number;
  pageSize?: number;
};

export type OpenDartFilingResponse = {
  rcept_no: string;
  corp_code: string;
  corp_name: string;
  stock_code?: string;
  report_nm: string;
  rcept_dt: string;
  flr_nm?: string;
};

export type OpenDartListResponse = {
  status: string;
  message: string;
  page_no?: number;
  page_count?: number;
  total_count?: number;
  total_page?: number;
  list?: OpenDartFilingResponse[];
};

function mapFilingType(type?: string): string {
  const mapping: Record<string, string> = {
    A: "정기공시",
    B: "주요사항보고",
    C: "발행공시",
    D: "지분공시",
    E: "기타공시",
    F: "외부감사관련",
    G: "펀드공시",
    H: "자산유동화",
    I: "거래소공시",
    J: "공정위공시",
  };
  return type ? mapping[type] || type : "기타";
}

export async function searchFilings(
  config: OpenDartConfig,
  params: SearchFilingsParams,
  now = Date.now()
): Promise<Filing[]> {
  const url = new URL(`${config.baseUrl}/list.json`);
  url.searchParams.set("crtfc_key", config.apiKey);

  if (params.corpCode) {
    url.searchParams.set("corp_code", params.corpCode);
  }
  if (params.startDate) {
    url.searchParams.set("bgn_de", params.startDate.replace(/-/g, ""));
  }
  if (params.endDate) {
    url.searchParams.set("end_de", params.endDate.replace(/-/g, ""));
  }
  if (params.filingType) {
    url.searchParams.set("pblntf_ty", params.filingType);
  }
  url.searchParams.set("page_no", String(params.pageNo || 1));
  url.searchParams.set("page_count", String(params.pageSize || 20));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "ZakkdevFinance/1.0" },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new OpenDartError(`API returned ${response.status}`, "api_error");
    }

    const data: OpenDartListResponse = await response.json();

    if (data.status !== "000" && data.status !== "013") {
      if (data.status === "013") {
        return [];
      }
      throw new OpenDartError(`API error: ${data.message}`, "api_error");
    }

    if (!data.list || data.list.length === 0) {
      return [];
    }

    return data.list.map((item) => {
      const { publishedDate, timePrecision } = parsePublishedDate(item.rcept_dt);
      const reportName = item.report_nm;
      const correction = isCorrection(reportName);

      return {
        receiptNo: item.rcept_no,
        corpCode: item.corp_code,
        corpName: item.corp_name,
        stockCode: item.stock_code,
        reportName,
        filingType: mapFilingType(item.flr_nm),
        publishedDate,
        timePrecision,
        firstSeenAt: now,
        url: formatFilingUrl(item.rcept_no),
        isCorrection: correction,
        priorReceiptNo: correction ? extractPriorReceiptNo(reportName, item.rcept_no) : undefined,
      };
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof OpenDartError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenDartError("Request timed out", "timeout");
    }
    throw new OpenDartError(
      error instanceof Error ? error.message : "Unknown error",
      "api_error"
    );
  }
}

export async function getFilingDetail(
  config: OpenDartConfig,
  receiptNo: string,
  now = Date.now()
): Promise<FilingDetail | null> {
  const filings = await searchFilings(config, {}, now);
  const filing = filings.find((f) => f.receiptNo === receiptNo);

  if (!filing) {
    return null;
  }

  return {
    ...filing,
    content: undefined,
    fetchedAt: now,
  };
}

export type FinancialsParams = {
  corpCode: string;
  year: string;
  reportCode: "11013" | "11012" | "11014" | "11011";
};

export type OpenDartFinancialsResponse = {
  status: string;
  message: string;
  list?: Array<{
    rcept_no: string;
    bsns_year: string;
    corp_code: string;
    stock_code?: string;
    account_nm: string;
    thstrm_nm?: string;
    thstrm_amount?: string;
    frmtrm_nm?: string;
    frmtrm_amount?: string;
    ord: string;
  }>;
};

function parseAmount(value?: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[,\s원]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? undefined : num;
}

export async function getFinancials(
  config: OpenDartConfig,
  params: FinancialsParams,
  now = Date.now()
): Promise<Financials | null> {
  const url = new URL(`${config.baseUrl}/fnlttSinglAcntAll.json`);
  url.searchParams.set("crtfc_key", config.apiKey);
  url.searchParams.set("corp_code", params.corpCode);
  url.searchParams.set("bsns_year", params.year);
  url.searchParams.set("reprt_code", params.reportCode);
  url.searchParams.set("fs_div", "CFS");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "ZakkdevFinance/1.0" },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new OpenDartError(`API returned ${response.status}`, "api_error");
    }

    const data: OpenDartFinancialsResponse = await response.json();

    if (data.status !== "000") {
      if (data.status === "013") {
        return null;
      }
      throw new OpenDartError(`API error: ${data.message}`, "api_error");
    }

    if (!data.list || data.list.length === 0) {
      return null;
    }

    const items: FinancialItem[] = data.list.map((item) => ({
      accountName: item.account_nm,
      currentPeriod: parseAmount(item.thstrm_amount),
      previousPeriod: parseAmount(item.frmtrm_amount),
      unit: "원",
    }));

    return {
      corpCode: params.corpCode,
      corpName: data.list[0]?.corp_code || params.corpCode,
      year: params.year,
      reportCode: params.reportCode,
      items,
      fetchedAt: now,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof OpenDartError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenDartError("Request timed out", "timeout");
    }
    throw new OpenDartError(
      error instanceof Error ? error.message : "Unknown error",
      "api_error"
    );
  }
}

export type MockOpenDartClient = {
  searchFilings: (params: SearchFilingsParams) => Promise<Filing[]>;
  getFilingDetail: (receiptNo: string) => Promise<FilingDetail | null>;
  getFinancials: (params: FinancialsParams) => Promise<Financials | null>;
};

export function createMockOpenDartClient(fixtures: {
  filings?: Filing[];
  filingDetails?: Record<string, FilingDetail>;
  financials?: Record<string, Financials>;
}): MockOpenDartClient {
  return {
    async searchFilings(params) {
      let results = fixtures.filings || [];

      if (params.corpCode) {
        results = results.filter((f) => f.corpCode === params.corpCode);
      }
      if (params.corpName) {
        results = results.filter((f) =>
          f.corpName.toLowerCase().includes(params.corpName!.toLowerCase())
        );
      }
      if (params.startDate) {
        const start = params.startDate.replace(/-/g, "");
        results = results.filter((f) => f.publishedDate.replace(/-/g, "") >= start);
      }
      if (params.endDate) {
        const end = params.endDate.replace(/-/g, "");
        results = results.filter((f) => f.publishedDate.replace(/-/g, "") <= end);
      }

      return results.slice(0, params.pageSize || 20);
    },

    async getFilingDetail(receiptNo) {
      return fixtures.filingDetails?.[receiptNo] || null;
    },

    async getFinancials(params) {
      const key = `${params.corpCode}_${params.year}_${params.reportCode}`;
      return fixtures.financials?.[key] || null;
    },
  };
}
