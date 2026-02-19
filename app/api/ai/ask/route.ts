import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getPostBySlug, searchPosts } from "@/entities/post";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

type AskBody = {
  question?: string;
};

type Source = {
  title: string;
  url: string;
  publishedAt: string;
};

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_posts",
      description:
        "Search blog posts by keyword and return relevant slugs, snippets, and URLs.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "User question or search query",
          },
          limit: {
            type: "integer",
            description: "Maximum number of posts to return (1-6)",
            minimum: 1,
            maximum: 6,
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_post",
      description:
        "Get full content for a specific post by slug when deeper context is needed.",
      parameters: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description: "The post slug, e.g. 2026-01-05",
          },
        },
        required: ["slug"],
        additionalProperties: false,
      },
    },
  },
];

const systemPrompt = [
  "You are an assistant for zakklee.dev.",
  "You must answer only with facts grounded in tool outputs.",
  "If the tools do not provide enough evidence, clearly say you do not know.",
  "Always answer in Korean.",
  "When referencing information, cite source URLs in the answer body using markdown links.",
].join(" ");

function parseJsonArguments(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function collectSource(
  sourceMap: Map<string, Source>,
  value: { title?: string; url?: string; publishedAt?: string }
) {
  if (!value.url || !value.title) return;
  sourceMap.set(value.url, {
    title: value.title,
    url: value.url,
    publishedAt: value.publishedAt || "",
  });
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  let body: AskBody;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    return NextResponse.json(
      { error: "요청 본문(JSON)을 읽을 수 없습니다." },
      { status: 400 }
    );
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json(
      { error: "질문(question)을 입력해주세요." },
      { status: 400 }
    );
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sources = new Map<string, Source>();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  try {
    for (let step = 0; step < 4; step += 1) {
      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages,
        tools,
        tool_choice: "auto",
      });

      const message = completion.choices[0]?.message;
      if (!message) {
        break;
      }

      messages.push({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      });

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return NextResponse.json({
          answer: message.content ?? "답변을 생성하지 못했습니다.",
          sources: Array.from(sources.values()),
        });
      }

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== "function") continue;

        const args = parseJsonArguments(toolCall.function.arguments || "{}");
        let result: unknown = {
          error: "지원하지 않는 도구 호출입니다.",
          name: toolCall.function.name,
        };

        if (toolCall.function.name === "search_posts") {
          const query =
            typeof args.query === "string" ? args.query : String(question);
          const requestedLimit =
            typeof args.limit === "number" ? args.limit : undefined;
          const limit = requestedLimit
            ? Math.max(1, Math.min(6, requestedLimit))
            : 4;
          const hits = searchPosts(query, limit);

          hits.forEach((hit) => collectSource(sources, hit));
          result = { hits };
        }

        if (toolCall.function.name === "get_post") {
          const slug = typeof args.slug === "string" ? args.slug : "";
          const post = getPostBySlug(slug);

          if (!post) {
            result = {
              error: "해당 slug의 포스트를 찾을 수 없습니다.",
              slug,
            };
          } else {
            collectSource(sources, post);
            result = {
              ...post,
              content: post.content.slice(0, 6000),
            };
          }
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    return NextResponse.json({
      answer:
        "현재 요청을 완료하지 못했습니다. 질문을 조금 더 구체적으로 입력해 주세요.",
      sources: Array.from(sources.values()),
    });
  } catch (error) {
    console.error("[/api/ai/ask] failed", error);
    return NextResponse.json(
      { error: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
