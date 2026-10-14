export type ParsedSource = {
  title: string;
  url: string;
  filingDate?: string;
  provider?: string;
};

export type ParsedAssistantMessage = {
  bodyMarkdown: string;
  datePrecision?: string;
  sources: ParsedSource[];
};

const SOURCE_LINK_PATTERN =
  /^\s*-\s*\[([^\]]+)\]\(([^)]+)\)\s*(?:-\s*DART(?:\s*공시)?\s*)?\((\d{4}-\d{2}-\d{2})\)/i;

/** Legacy markdown footer parsing for messages stored before structured output. */
export function parseLegacyAssistantMessage(content: string): ParsedAssistantMessage {
  const datePrecisionMatch = content.match(/📅\s*날짜\s*정확도:\s*(.+?)(?:\n|$)/);
  const datePrecision = datePrecisionMatch?.[1]?.trim();

  let body = content;
  let sourcesBlock = "";

  const dividerIdx = body.search(/\n---\s*\n/);
  if (dividerIdx >= 0) {
    sourcesBlock = body.slice(dividerIdx);
    body = body.slice(0, dividerIdx);
  } else {
    const sourceHeader = body.search(/\n\*\*출처:\*\*/i);
    if (sourceHeader >= 0) {
      sourcesBlock = body.slice(sourceHeader);
      body = body.slice(0, sourceHeader);
    }
  }

  body = body.replace(/📅\s*날짜\s*정확도:.+?(?:\n|$)/, "").trim();

  const sources: ParsedSource[] = [];
  const sourceLines = sourcesBlock.split("\n");
  for (const line of sourceLines) {
    const mdMatch = line.match(SOURCE_LINK_PATTERN);
    if (mdMatch) {
      sources.push({
        title: mdMatch[1].trim(),
        url: mdMatch[2].trim(),
        filingDate: mdMatch[3],
        provider: "DART",
      });
      continue;
    }
    const inlineDate = line.match(/\((\d{4}-\d{2}-\d{2})\)/);
    const urlMatch = line.match(/\((https?:\/\/[^)]+)\)/);
    const titleMatch = line.match(/\[([^\]]+)\]/);
    if (urlMatch && titleMatch) {
      sources.push({
        title: titleMatch[1],
        url: urlMatch[1],
        filingDate: inlineDate?.[1],
        provider: line.includes("DART") ? "DART" : undefined,
      });
    }
  }

  return { bodyMarkdown: body.trim(), datePrecision, sources };
}
