import "server-only";
import type { AgentRunResult } from "../agent/types";
import type { RunReportData } from "./types";

export function agentRunResultToReportData(result: AgentRunResult): RunReportData | undefined {
  if (result.status !== "completed") {
    return undefined;
  }
  const body = result.bodyMarkdown ?? result.response;
  if (!body && !result.blocks?.length) {
    return undefined;
  }
  return {
    response: body,
    bodyMarkdown: body,
    blocks: result.blocks ? [...result.blocks] : [],
    sources: result.sources ? [...result.sources] : [],
    datePrecision: result.datePrecision,
    structuredFallback: result.structuredFallback,
    reportId: result.runId,
  };
}
