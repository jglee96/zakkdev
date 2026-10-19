export const RESPOND_TOOL_NAME = "respond";

export const RESPOND_TOOL_DEFINITION = {
  name: RESPOND_TOOL_NAME,
  description:
    "사용자에게 최종 답변을 전달합니다. bodyMarkdown과 blocks를 제출하세요. blocks의 sourceId는 도구 결과에서 수집된 ID만 사용하고 URL을 만들지 마세요.",
  parameters: {
    type: "object",
    properties: {
      bodyMarkdown: { type: "string", description: "사용자에게 보여줄 마크다운 본문" },
      datePrecision: {
        type: "string",
        description: "날짜 정확도 설명 (공시일만 있는 경우 등). 없는 시각을 만들지 마세요.",
      },
      blocks: {
        type: "array",
        items: {
          oneOf: [
            {
              type: "object",
              properties: {
                type: { const: "disclosure" },
                sourceId: { type: "string" },
                headline: { type: "string" },
                summaryMarkdown: { type: "string" },
              },
              required: ["type", "sourceId"],
            },
            {
              type: "object",
              properties: {
                type: { const: "thesis" },
                claim: { type: "string" },
                stance: { enum: ["supports", "refutes", "neutral"] },
                evidenceSourceIds: { type: "array", items: { type: "string" } },
              },
              required: ["type", "claim", "stance", "evidenceSourceIds"],
            },
            {
              type: "object",
              properties: {
                type: { const: "financials" },
                sourceId: { type: "string" },
                metricsMarkdown: { type: "string" },
              },
              required: ["type", "metricsMarkdown"],
            },
            {
              type: "object",
              properties: {
                type: { const: "markdown" },
                content: { type: "string" },
              },
              required: ["type", "content"],
            },
          ],
        },
      },
    },
    required: ["bodyMarkdown", "blocks"],
    additionalProperties: false,
  },
  requiresAuth: false,
  mutates: false,
} as const;
