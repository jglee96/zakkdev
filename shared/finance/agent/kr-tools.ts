import "server-only";
import type { AgentRunContext } from "./types";
import type { AgentRuntimeConfig, ToolExecutor } from "./runtime";
import {
  type Filing,
  type Thesis,
  type Evidence,
  type ThesisStatus,
  type MockOpenDartClient,
  OpenDartError,
  createOpenDartConfig,
  searchFilings,
  getFilingDetail as dartGetFilingDetail,
  getFinancials as dartGetFinancials,
  createThesis,
  findThesesBySubject,
  updateThesis,
  saveSource,
  hasSource,
  buildComparisonReport,
  validateNumericConsistency,
} from "../data";

export type KRToolsConfig = {
  dartClient?: MockOpenDartClient;
};

let mockDartClient: MockOpenDartClient | undefined;

export function setMockDartClient(client: MockOpenDartClient | undefined) {
  mockDartClient = client;
}

export function getMockDartClient(): MockOpenDartClient | undefined {
  return mockDartClient;
}

export async function executeSearchDartFilings(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const corpName = args.corpName as string | undefined;
  const corpCode = args.corpCode as string | undefined;
  const startDate = args.startDate as string | undefined;
  const endDate = args.endDate as string | undefined;
  const filingType = args.filingType as string | undefined;

  if (!corpName && !corpCode) {
    return { error: "corpName 또는 corpCode 중 하나는 필수입니다." };
  }

  try {
    let filings: Filing[];

    if (mockDartClient) {
      filings = await mockDartClient.searchFilings({
        corpName,
        corpCode,
        startDate,
        endDate,
        filingType,
      });
    } else {
      const config = createOpenDartConfig();
      filings = await searchFilings(config, {
        corpName,
        corpCode,
        startDate,
        endDate,
        filingType,
      });
    }

    for (const filing of filings) {
      const exists = await hasSource(
        { tableName: runtime.repoConfig.tableName, client: runtime.repoConfig.client },
        "dart",
        filing.receiptNo
      );
      if (!exists) {
        await saveSource(
          { tableName: runtime.repoConfig.tableName, client: runtime.repoConfig.client },
          filing
        );
      }
    }

    return {
      filings: filings.map((f) => ({
        receiptNo: f.receiptNo,
        corpName: f.corpName,
        reportName: f.reportName,
        publishedDate: f.publishedDate,
        timePrecision: f.timePrecision,
        url: f.url,
        isCorrection: f.isCorrection,
      })),
      count: filings.length,
      message: filings.length > 0
        ? `${filings.length}건의 공시를 찾았습니다.`
        : "검색 결과가 없습니다.",
    };
  } catch (error) {
    if (error instanceof OpenDartError) {
      if (error.code === "config_error") {
        return { error: "OpenDART API 키가 설정되지 않았습니다.", code: error.code };
      }
      return { error: error.message, code: error.code };
    }
    return { error: error instanceof Error ? error.message : "공시 검색에 실패했습니다." };
  }
}

export async function executeGetFilingDetail(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const receiptNo = args.receiptNo as string;

  if (!receiptNo) {
    return { error: "receiptNo는 필수입니다." };
  }

  try {
    if (mockDartClient) {
      const detail = await mockDartClient.getFilingDetail(receiptNo);
      if (!detail) {
        return { error: "공시를 찾을 수 없습니다.", receiptNo };
      }
      return {
        filing: {
          receiptNo: detail.receiptNo,
          corpName: detail.corpName,
          reportName: detail.reportName,
          publishedDate: detail.publishedDate,
          timePrecision: detail.timePrecision,
          url: detail.url,
          isCorrection: detail.isCorrection,
          priorReceiptNo: detail.priorReceiptNo,
        },
      };
    }

    const config = createOpenDartConfig();
    const detail = await dartGetFilingDetail(config, receiptNo);
    if (!detail) {
      return { error: "공시를 찾을 수 없습니다.", receiptNo };
    }

    return {
      filing: {
        receiptNo: detail.receiptNo,
        corpName: detail.corpName,
        reportName: detail.reportName,
        publishedDate: detail.publishedDate,
        timePrecision: detail.timePrecision,
        url: detail.url,
        isCorrection: detail.isCorrection,
        priorReceiptNo: detail.priorReceiptNo,
      },
    };
  } catch (error) {
    if (error instanceof OpenDartError) {
      return { error: error.message, code: error.code };
    }
    return { error: error instanceof Error ? error.message : "공시 상세 조회에 실패했습니다." };
  }
}

export async function executeGetFinancials(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const corpCode = args.corpCode as string;
  const year = args.year as string;
  const reportCode = args.reportCode as "11013" | "11012" | "11014" | "11011";

  if (!corpCode || !year || !reportCode) {
    return { error: "corpCode, year, reportCode는 모두 필수입니다." };
  }

  try {
    if (mockDartClient) {
      const financials = await mockDartClient.getFinancials({ corpCode, year, reportCode });
      if (!financials) {
        return { error: "재무제표를 찾을 수 없습니다.", corpCode, year, reportCode };
      }

      const validatedItems = financials.items.map((item) => {
        const currentValidation = validateNumericConsistency(item.currentPeriod, item.unit);
        const previousValidation = validateNumericConsistency(item.previousPeriod, item.unit);

        return {
          accountName: item.accountName,
          currentPeriod: currentValidation.normalized,
          previousPeriod: previousValidation.normalized,
          unit: item.unit,
          warnings: [
            currentValidation.error,
            previousValidation.error,
          ].filter(Boolean),
        };
      });

      return {
        corpCode: financials.corpCode,
        year: financials.year,
        reportCode: financials.reportCode,
        items: validatedItems,
        fetchedAt: financials.fetchedAt,
      };
    }

    const config = createOpenDartConfig();
    const financials = await dartGetFinancials(config, { corpCode, year, reportCode });
    if (!financials) {
      return { error: "재무제표를 찾을 수 없습니다.", corpCode, year, reportCode };
    }

    const validatedItems = financials.items.map((item) => {
      const currentValidation = validateNumericConsistency(item.currentPeriod, item.unit);
      const previousValidation = validateNumericConsistency(item.previousPeriod, item.unit);

      return {
        accountName: item.accountName,
        currentPeriod: currentValidation.normalized,
        previousPeriod: previousValidation.normalized,
        unit: item.unit,
        warnings: [
          currentValidation.error,
          previousValidation.error,
        ].filter(Boolean),
      };
    });

    return {
      corpCode: financials.corpCode,
      year: financials.year,
      reportCode: financials.reportCode,
      items: validatedItems,
      fetchedAt: financials.fetchedAt,
    };
  } catch (error) {
    if (error instanceof OpenDartError) {
      return { error: error.message, code: error.code };
    }
    return { error: error instanceof Error ? error.message : "재무제표 조회에 실패했습니다." };
  }
}

export async function executeFindRelevantTheses(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const subject = args.subject as string;
  const status = (args.status as ThesisStatus | "all") || "all";

  if (!subject) {
    return { error: "subject는 필수입니다." };
  }

  try {
    const theses = await findThesesBySubject(
      { tableName: runtime.repoConfig.tableName, client: runtime.repoConfig.client },
      context.ownerId,
      context.botId,
      subject,
      status
    );

    return {
      theses: theses.map((t) => ({
        id: t.id,
        subject: t.subject,
        thesis: t.thesis,
        status: t.status,
        evidenceCount: t.evidence.length,
        lastEvidence: t.evidence.length > 0
          ? {
              sourceId: t.evidence[t.evidence.length - 1].sourceId,
              sourceUrl: t.evidence[t.evidence.length - 1].sourceUrl,
              summary: t.evidence[t.evidence.length - 1].summary,
              supportType: t.evidence[t.evidence.length - 1].supportType,
            }
          : null,
        updatedAt: t.updatedAt,
      })),
      count: theses.length,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "가설 검색에 실패했습니다." };
  }
}

export async function executeSaveInsight(
  args: Record<string, unknown>,
  context: AgentRunContext,
  runtime: AgentRuntimeConfig
): Promise<unknown> {
  const subject = args.subject as string;
  const thesis = args.thesis as string;
  const evidenceInput = args.evidence as Array<{
    sourceType: string;
    sourceId: string;
    sourceUrl?: string;
    summary: string;
  }>;
  const status = (args.status as ThesisStatus) || "active";

  if (!subject || !thesis || !evidenceInput || evidenceInput.length === 0) {
    return { error: "subject, thesis, evidence(1개 이상)는 필수입니다." };
  }

  for (const e of evidenceInput) {
    if (!e.sourceId || !e.summary) {
      return { error: "각 evidence에는 sourceId와 summary가 필수입니다." };
    }
    if (!e.sourceUrl) {
      return {
        error: `증거 ${e.sourceId}에 sourceUrl이 누락되었습니다. 모든 증거에는 원문 URL이 필요합니다.`,
      };
    }
  }

  const now = Date.now();

  try {
    const existingTheses = await findThesesBySubject(
      { tableName: runtime.repoConfig.tableName, client: runtime.repoConfig.client },
      context.ownerId,
      context.botId,
      subject,
      "all"
    );

    const evidence: Array<Omit<Evidence, "id" | "addedAt">> = evidenceInput.map((e) => ({
      sourceType: e.sourceType as "dart_filing" | "sec_filing" | "news" | "manual",
      sourceId: e.sourceId,
      sourceUrl: e.sourceUrl,
      publishedDate: new Date().toISOString().slice(0, 10),
      timePrecision: "date" as const,
      firstSeenAt: now,
      summary: e.summary,
      supportType: status === "supported" ? "supports" as const :
                  status === "contradicted" ? "contradicts" as const : "neutral" as const,
    }));

    if (existingTheses.length > 0) {
      const existingThesis = existingTheses[0];
      const updatedThesis = await updateThesis(
        { tableName: runtime.repoConfig.tableName, client: runtime.repoConfig.client },
        context.ownerId,
        context.botId,
        existingThesis.id,
        {
          thesis,
          status,
          addEvidence: evidence,
        },
        now
      );

      return {
        action: "updated",
        thesis: {
          id: updatedThesis.id,
          subject: updatedThesis.subject,
          thesis: updatedThesis.thesis,
          status: updatedThesis.status,
          evidenceCount: updatedThesis.evidence.length,
          version: updatedThesis.version,
        },
        message: `기존 가설이 업데이트되었습니다. (버전 ${updatedThesis.version})`,
      };
    }

    const newThesis = await createThesis(
      { tableName: runtime.repoConfig.tableName, client: runtime.repoConfig.client },
      context.ownerId,
      {
        botId: context.botId,
        subject,
        thesis,
        evidence,
        status,
      },
      now
    );

    return {
      action: "created",
      thesis: {
        id: newThesis.id,
        subject: newThesis.subject,
        thesis: newThesis.thesis,
        status: newThesis.status,
        evidenceCount: newThesis.evidence.length,
        version: newThesis.version,
      },
      message: "새 투자 가설이 저장되었습니다.",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "가설 저장에 실패했습니다." };
  }
}

export function createKRToolExecutor(): ToolExecutor {
  return async (name, args, context, runtime) => {
    switch (name) {
      case "search_dart_filings":
        return executeSearchDartFilings(args, context, runtime);
      case "get_filing_detail":
        return executeGetFilingDetail(args, context, runtime);
      case "get_financials":
        return executeGetFinancials(args, context, runtime);
      case "find_relevant_theses":
        return executeFindRelevantTheses(args, context, runtime);
      case "save_insight":
        return executeSaveInsight(args, context, runtime);
      default:
        return { error: `Unknown KR tool: ${name}` };
    }
  };
}

export function buildAnalysisReport(
  thesis: Thesis,
  filings: Filing[],
  referenceDate = new Date()
): {
  summary: string;
  thesis: {
    id: string;
    subject: string;
    thesis: string;
    status: ThesisStatus;
  };
  newFindings: Array<{
    receiptNo: string;
    reportName: string;
    publishedDate: string;
    url: string;
    isWithinRetrospective: boolean;
  }>;
  existingEvidence: Array<{
    sourceId: string;
    sourceUrl?: string;
    summary: string;
    supportType: string;
  }>;
  warnings: string[];
} {
  const report = buildComparisonReport(thesis, filings, referenceDate);

  const newFindings = report.comparisons
    .filter((c) => c.isNew)
    .map((c) => ({
      receiptNo: c.filing.receiptNo,
      reportName: c.filing.reportName,
      publishedDate: c.filing.publishedDate,
      url: c.filing.url,
      isWithinRetrospective: c.withinRetrospective,
    }));

  const existingEvidence = report.existingEvidence.map((e) => ({
    sourceId: e.sourceId,
    sourceUrl: e.sourceUrl,
    summary: e.summary,
    supportType: e.supportType,
  }));

  const withinRetro = newFindings.filter((f) => f.isWithinRetrospective).length;
  const outsideRetro = newFindings.length - withinRetro;

  let summary = `[${thesis.subject}] 가설 분석 보고서\n\n`;
  summary += `현재 가설: ${thesis.thesis}\n`;
  summary += `상태: ${thesis.status}\n\n`;
  summary += `신규 공시: ${newFindings.length}건 (기준일 이내: ${withinRetro}건, 이후: ${outsideRetro}건)\n`;
  summary += `기존 증거: ${existingEvidence.length}건\n`;

  if (report.warnings.length > 0) {
    summary += `\n경고:\n${report.warnings.map((w) => `- ${w}`).join("\n")}`;
  }

  return {
    summary,
    thesis: {
      id: thesis.id,
      subject: thesis.subject,
      thesis: thesis.thesis,
      status: thesis.status,
    },
    newFindings,
    existingEvidence,
    warnings: report.warnings,
  };
}
