import "server-only";

export type TimePrecision = "date" | "datetime";

export type Filing = {
  readonly receiptNo: string;
  readonly corpCode: string;
  readonly corpName: string;
  readonly stockCode?: string;
  readonly reportName: string;
  readonly filingType: string;
  readonly publishedDate: string;
  readonly publishedAt?: string;
  readonly timePrecision: TimePrecision;
  readonly firstSeenAt: number;
  readonly url: string;
  readonly isCorrection: boolean;
  readonly priorReceiptNo?: string;
};

export type FilingDetail = Filing & {
  readonly content?: string;
  readonly fetchedAt: number;
};

export type Financials = {
  readonly corpCode: string;
  readonly corpName: string;
  readonly year: string;
  readonly reportCode: string;
  readonly items: ReadonlyArray<FinancialItem>;
  readonly fetchedAt: number;
};

export type FinancialItem = {
  readonly accountName: string;
  readonly currentPeriod?: number;
  readonly previousPeriod?: number;
  readonly unit: string;
};

export type ThesisStatus = "active" | "supported" | "contradicted" | "neutral" | "archived";

export type Evidence = {
  readonly id: string;
  readonly sourceType: "dart_filing" | "sec_filing" | "news" | "manual";
  readonly sourceId: string;
  readonly sourceUrl?: string;
  readonly publishedDate: string;
  readonly publishedAt?: string;
  readonly timePrecision: TimePrecision;
  readonly firstSeenAt: number;
  readonly summary: string;
  readonly supportType: "supports" | "contradicts" | "neutral";
  readonly addedAt: number;
};

export type Thesis = {
  readonly id: string;
  readonly ownerId: string;
  readonly botId: string;
  readonly subject: string;
  readonly ticker?: string;
  readonly corpCode?: string;
  readonly thesis: string;
  readonly status: ThesisStatus;
  readonly evidence: ReadonlyArray<Evidence>;
  readonly version: number;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type CreateThesisInput = {
  botId: string;
  subject: string;
  ticker?: string;
  corpCode?: string;
  thesis: string;
  evidence: Array<Omit<Evidence, "id" | "addedAt">>;
  status?: ThesisStatus;
};

export type UpdateThesisInput = {
  thesis?: string;
  status?: ThesisStatus;
  addEvidence?: Array<Omit<Evidence, "id" | "addedAt">>;
};

export type Source = {
  readonly id: string;
  readonly provider: "dart" | "sec" | "news";
  readonly sourceId: string;
  readonly corpCode?: string;
  readonly ticker?: string;
  readonly publishedDate: string;
  readonly publishedAt?: string;
  readonly timePrecision: TimePrecision;
  readonly firstSeenAt: number;
  readonly fetchedAt: number;
  readonly url: string;
  readonly revision?: number;
  readonly priorSourceId?: string;
};

export function parsePublishedDate(rcptDt: string): { publishedDate: string; timePrecision: TimePrecision } {
  const cleaned = rcptDt.replace(/\D/g, "");
  if (cleaned.length === 8) {
    return {
      publishedDate: `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`,
      timePrecision: "date",
    };
  }
  return { publishedDate: rcptDt, timePrecision: "date" };
}

export function isValidPublishedDate(publishedDate: string, referenceDate: Date): boolean {
  const date = new Date(publishedDate);
  if (isNaN(date.getTime())) return false;
  return date <= referenceDate;
}

export function formatFilingUrl(receiptNo: string): string {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${receiptNo}`;
}

export function isCorrection(reportName: string): boolean {
  return /정정|수정|첨부정정|기재정정/.test(reportName);
}

export function extractPriorReceiptNo(reportName: string, receiptNo: string): string | undefined {
  const match = /\(정정\s*(\d+)\)|\[정정\s*(\d+)\]/.exec(reportName);
  if (match) {
    return match[1] || match[2];
  }
  return undefined;
}
