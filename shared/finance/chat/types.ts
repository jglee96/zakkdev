/** Shared finance chat structured payload types (client + server safe). */

export type SourceProvider = "dart" | "edgar" | "other";

export type SourceTimePrecision = "date" | "datetime" | "unknown";

export type ChatSource = {
  id: string;
  provider: SourceProvider;
  title: string;
  url: string;
  receiptNo?: string;
  sourceId?: string;
  filingDate?: string;
  timePrecision: SourceTimePrecision;
  firstSeenAt: number;
};

export type DisclosureBlock = {
  type: "disclosure";
  sourceId: string;
  headline?: string;
  summaryMarkdown?: string;
};

export type ThesisBlock = {
  type: "thesis";
  claim: string;
  stance: "supports" | "refutes" | "neutral";
  evidenceSourceIds: string[];
};

export type FinancialsBlock = {
  type: "financials";
  sourceId?: string;
  metricsMarkdown: string;
};

export type MarkdownBlock = {
  type: "markdown";
  content: string;
};

export type ChatBlock = DisclosureBlock | ThesisBlock | FinancialsBlock | MarkdownBlock;

export type StructuredAssistantPayload = {
  bodyMarkdown: string;
  datePrecision?: string;
  blocks: ChatBlock[];
};

export type ValidatedAssistantMessage = StructuredAssistantPayload & {
  sources: ChatSource[];
  structuredFallback: boolean;
  droppedBlockCount: number;
};
