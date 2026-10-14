import type { ChatSource, SourceProvider, SourceTimePrecision } from "./types";

export type SourceRegistry = {
  list: () => ChatSource[];
  get: (id: string) => ChatSource | undefined;
  ingestToolResult: (toolName: string, result: unknown, seenAt: number) => void;
};

function dartId(receiptNo: string) {
  return `dart:${receiptNo}`;
}

function mapTimePrecision(value: unknown): SourceTimePrecision {
  if (value === "datetime" || value === "date") return value;
  return "unknown";
}

function addDartFiling(
  map: Map<string, ChatSource>,
  filing: Record<string, unknown>,
  seenAt: number,
) {
  const receiptNo = String(filing.receiptNo || filing.sourceId || "");
  if (!receiptNo) return;
  const url = String(filing.url || filing.sourceUrl || "");
  if (!url) return;
  const id = dartId(receiptNo);
  if (map.has(id)) return;
  const publishedDate = filing.publishedDate ? String(filing.publishedDate) : undefined;
  const timePrecision = mapTimePrecision(filing.timePrecision);
  map.set(id, {
    id,
    provider: "dart",
    title: String(filing.reportName || filing.corpName || receiptNo),
    url,
    receiptNo,
    sourceId: receiptNo,
    filingDate: publishedDate,
    timePrecision,
    firstSeenAt: seenAt,
  });
}

function ingestEvidence(
  map: Map<string, ChatSource>,
  evidence: Record<string, unknown>,
  seenAt: number,
) {
  const sourceType = String(evidence.sourceType || "");
  const provider: SourceProvider = sourceType.includes("dart") ? "dart" : sourceType.includes("sec") ? "edgar" : "other";
  const sourceId = String(evidence.sourceId || evidence.receiptNo || "");
  const url = String(evidence.sourceUrl || evidence.url || "");
  if (!sourceId || !url) return;
  const id = provider === "dart" ? dartId(sourceId) : `${provider}:${sourceId}`;
  if (map.has(id)) return;
  map.set(id, {
    id,
    provider,
    title: String(evidence.summary || sourceId).slice(0, 120),
    url,
    receiptNo: provider === "dart" ? sourceId : undefined,
    sourceId,
    filingDate: evidence.filingDate ? String(evidence.filingDate) : undefined,
    timePrecision: evidence.timePrecision ? mapTimePrecision(evidence.timePrecision) : "unknown",
    firstSeenAt: seenAt,
  });
}

export function createSourceRegistry(): SourceRegistry {
  const map = new Map<string, ChatSource>();

  return {
    list: () => Array.from(map.values()),
    get: (id) => map.get(id),
    ingestToolResult: (toolName, result, seenAt) => {
      if (!result || typeof result !== "object") return;
      const record = result as Record<string, unknown>;
      if (Array.isArray(record.filings)) {
        for (const filing of record.filings) {
          if (filing && typeof filing === "object") {
            addDartFiling(map, filing as Record<string, unknown>, seenAt);
          }
        }
      }
      if (record.filing && typeof record.filing === "object") {
        addDartFiling(map, record.filing as Record<string, unknown>, seenAt);
      }
      if (Array.isArray(record.evidence)) {
        for (const ev of record.evidence) {
          if (ev && typeof ev === "object") {
            ingestEvidence(map, ev as Record<string, unknown>, seenAt);
          }
        }
      }
      if (toolName === "save_insight" && record.thesis && typeof record === "object") {
        const nested = record as { evidence?: unknown[] };
        if (Array.isArray(nested.evidence)) {
          for (const ev of nested.evidence) {
            if (ev && typeof ev === "object") {
              ingestEvidence(map, ev as Record<string, unknown>, seenAt);
            }
          }
        }
      }
    },
  };
}
