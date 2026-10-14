import assert from "node:assert/strict";
import { test } from "node:test";
import { agentRunResultToReportData } from "../../shared/finance/worker/report-data";

test("agentRunResultToReportData maps structured agent completion to run report", () => {
  const report = agentRunResultToReportData({
    runId: "run-1",
    botId: "bot-1",
    status: "completed",
    bodyMarkdown: "요약",
    blocks: [{ type: "markdown", content: "detail" }],
    sources: [
      {
        id: "dart:1",
        provider: "dart",
        title: "공시",
        url: "https://dart.fss.or.kr/x",
        timePrecision: "date",
        firstSeenAt: 1,
      },
    ],
    datePrecision: "공시일만",
    structuredFallback: false,
    usage: { steps: 1, calls: 1, inputTokens: 1, outputTokens: 1, costUsd: 0 },
    durationMs: 10,
  });

  assert.ok(report);
  assert.equal(report?.bodyMarkdown, "요약");
  assert.equal(report?.blocks?.length, 1);
  assert.equal(report?.sources?.length, 1);
  assert.equal(report?.reportId, "run-1");
});

test("agentRunResultToReportData returns undefined for non-completed runs", () => {
  assert.equal(
    agentRunResultToReportData({
      runId: "r",
      botId: "b",
      status: "error",
      usage: { steps: 0, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      durationMs: 1,
    }),
    undefined,
  );
});
