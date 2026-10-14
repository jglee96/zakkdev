import assert from "node:assert/strict";
import { test } from "node:test";
import { createSourceRegistry } from "../../shared/finance/chat/source-registry";
import {
  buildValidatedMessage,
  sanitizeBlocks,
  validateRespondToolArgs,
} from "../../shared/finance/chat/validate-response";
import { finalizeFromRespondTool } from "../../shared/finance/chat/finalize-response";

test("validateRespondToolArgs rejects fabricated source references in blocks", () => {
  const registry = createSourceRegistry();
  registry.ingestToolResult(
    "search_dart_filings",
    {
      filings: [
        {
          receiptNo: "20261001000001",
          reportName: "반기보고서",
          publishedDate: "2026-10-01",
          timePrecision: "date",
          url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261001000001",
        },
      ],
    },
    Date.now(),
  );

  const args = validateRespondToolArgs({
    bodyMarkdown: "요약",
    blocks: [
      { type: "disclosure", sourceId: "dart:20261001000001" },
      { type: "disclosure", sourceId: "dart:fake-receipt" },
    ],
  });
  assert.ok(args);
  const validated = buildValidatedMessage(args!, registry.list(), false);
  assert.equal(validated.blocks.length, 1);
  assert.equal(validated.droppedBlockCount, 1);
});

test("sanitizeBlocks drops thesis evidence ids not in registry", () => {
  const known = new Set(["dart:a"]);
  const { blocks, dropped } = sanitizeBlocks(
    [
      {
        type: "thesis",
        claim: "test",
        stance: "supports",
        evidenceSourceIds: ["dart:a", "dart:b"],
      },
    ],
    known,
  );
  assert.equal(dropped, 1);
  assert.equal(blocks.length, 0);
});

test("finalizeFromRespondTool returns validated message with server sources", async () => {
  const registry = createSourceRegistry();
  registry.ingestToolResult(
    "get_filing_detail",
    {
      filing: {
        receiptNo: "20260801000004",
        reportName: "분기보고서",
        publishedDate: "2026-08-01",
        timePrecision: "date",
        url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260801000004",
      },
    },
    1_700_000_000_000,
  );

  const message = await finalizeFromRespondTool(
    {
      bodyMarkdown: "분기 실적 개선",
      datePrecision: "공시 접수일만 확인됨 (시각 없음)",
      blocks: [{ type: "disclosure", sourceId: "dart:20260801000004", headline: "분기보고서" }],
    },
    registry,
  );
  assert.ok(message);
  assert.equal(message!.sources.length, 1);
  assert.equal(message!.sources[0].firstSeenAt, 1_700_000_000_000);
  assert.equal(message!.blocks.length, 1);
});
