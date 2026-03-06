import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { getBlogPosts } from "./read-posts";
import type {
  PostEmbeddingIndex,
  PostEmbeddingItem,
  SearchPostResult,
} from "../model/types";

type SearchablePost = {
  slug: string;
  title: string;
  publishedAt: string;
  summary: string;
  content: string;
  url: string;
  dateValue: number;
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
};

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "to",
  "of",
  "in",
  "for",
  "on",
  "and",
  "or",
  "that",
  "this",
  "it",
  "with",
  "by",
  "as",
  "at",
]);

const VECTOR_INDEX_PATH = path.join(
  process.cwd(),
  "shared",
  "vector",
  "post-embeddings.json"
);
const DEFAULT_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

let cachedCorpus: SearchablePost[] | null = null;
let cachedVectorIndex: PostEmbeddingIndex | null | undefined;
let cachedOpenAIClient: OpenAI | null | undefined;

function stripMarkdown(input: string) {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toQueryTerms(query: string) {
  return normalizeText(query)
    .split(" ")
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function isPostEmbeddingItem(value: unknown): value is PostEmbeddingItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.slug === "string" &&
    typeof item.title === "string" &&
    typeof item.publishedAt === "string" &&
    typeof item.summary === "string" &&
    typeof item.url === "string" &&
    isNumberArray(item.embedding)
  );
}

function loadVectorIndex() {
  if (cachedVectorIndex !== undefined) return cachedVectorIndex;

  if (!fs.existsSync(VECTOR_INDEX_PATH)) {
    cachedVectorIndex = null;
    return cachedVectorIndex;
  }

  try {
    const raw = fs.readFileSync(VECTOR_INDEX_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PostEmbeddingIndex>;

    const items = Array.isArray(parsed.items)
      ? parsed.items.filter(isPostEmbeddingItem)
      : [];
    if (items.length === 0) {
      cachedVectorIndex = null;
      return cachedVectorIndex;
    }

    cachedVectorIndex = {
      model:
        typeof parsed.model === "string" && parsed.model
          ? parsed.model
          : DEFAULT_EMBEDDING_MODEL,
      dimensions:
        typeof parsed.dimensions === "number" && Number.isFinite(parsed.dimensions)
          ? parsed.dimensions
          : items[0].embedding.length,
      createdAt:
        typeof parsed.createdAt === "string" ? parsed.createdAt : new Date(0).toISOString(),
      items,
    };
  } catch {
    cachedVectorIndex = null;
  }

  return cachedVectorIndex;
}

function getOpenAIClient() {
  if (cachedOpenAIClient !== undefined) return cachedOpenAIClient;

  if (!process.env.OPENAI_API_KEY) {
    cachedOpenAIClient = null;
    return cachedOpenAIClient;
  }

  cachedOpenAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return cachedOpenAIClient;
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getCorpus() {
  if (cachedCorpus) return cachedCorpus;

  cachedCorpus = getBlogPosts().map((post) => {
    const title = post.metadata.title ?? post.slug;
    const summary = post.metadata.summary ?? "";
    const content = stripMarkdown(post.content);
    const publishedAt = post.metadata.publishedAt ?? "";

    return {
      slug: post.slug,
      title,
      publishedAt,
      summary,
      content,
      url: `/blog/${post.slug}`,
      dateValue: Date.parse(publishedAt) || 0,
      normalizedTitle: normalizeText(title),
      normalizedSummary: normalizeText(summary),
      normalizedContent: normalizeText(content),
    };
  });

  return cachedCorpus;
}

function buildSnippet(content: string, query: string) {
  const clean = content.trim();
  if (!clean) return "";

  const terms = toQueryTerms(query);
  const lowered = clean.toLowerCase();
  const matchIndex = terms.reduce((bestIndex, term) => {
    if (bestIndex !== -1) return bestIndex;
    return lowered.indexOf(term.toLowerCase());
  }, -1);

  if (matchIndex === -1) {
    return clean.slice(0, 260);
  }

  const start = Math.max(0, matchIndex - 90);
  const end = Math.min(clean.length, start + 280);
  const prefix = start > 0 ? "... " : "";
  const suffix = end < clean.length ? " ..." : "";

  return `${prefix}${clean.slice(start, end)}${suffix}`;
}

function scorePost(post: SearchablePost, query: string, terms: string[]) {
  const normalizedQuery = normalizeText(query);
  let score = 0;

  if (normalizedQuery && post.normalizedTitle.includes(normalizedQuery)) {
    score += 24;
  }
  if (normalizedQuery && post.normalizedSummary.includes(normalizedQuery)) {
    score += 14;
  }
  if (normalizedQuery && post.normalizedContent.includes(normalizedQuery)) {
    score += 8;
  }

  for (const term of terms) {
    if (post.normalizedTitle.includes(term)) score += 8;
    if (post.normalizedSummary.includes(term)) score += 4;
    if (post.normalizedContent.includes(term)) score += 2;
  }

  return score;
}

function searchPostsByKeyword(query: string, limit = 4): SearchPostResult[] {
  if (!query.trim()) return [];

  const corpus = getCorpus();
  const terms = toQueryTerms(query);

  return corpus
    .map((post) => ({
      post,
      score: scorePost(post, query, terms),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.post.dateValue - a.post.dateValue;
    })
    .slice(0, Math.max(1, Math.min(limit, 6)))
    .map(({ post, score }) => ({
      slug: post.slug,
      title: post.title,
      publishedAt: post.publishedAt,
      summary: post.summary,
      snippet: buildSnippet(post.content, query),
      url: post.url,
      score,
    }));
}

async function searchPostsByVector(query: string, limit = 4) {
  const index = loadVectorIndex();
  const client = getOpenAIClient();

  if (!index || !client || !query.trim()) return [];

  try {
    const embeddingResponse = await client.embeddings.create({
      model: index.model || DEFAULT_EMBEDDING_MODEL,
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0]?.embedding;

    if (!queryEmbedding || queryEmbedding.length !== index.dimensions) {
      return [];
    }

    const corpus = getCorpus();
    const postMap = new Map(corpus.map((post) => [post.slug, post]));

    return index.items
      .map((item) => {
        const post = postMap.get(item.slug);
        if (!post) return null;

        return {
          post,
          score: cosineSimilarity(queryEmbedding, item.embedding),
        };
      })
      .filter((item): item is { post: SearchablePost; score: number } => Boolean(item))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.post.dateValue - a.post.dateValue;
      })
      .slice(0, Math.max(1, Math.min(limit, 6)))
      .map(({ post, score }) => ({
        slug: post.slug,
        title: post.title,
        publishedAt: post.publishedAt,
        summary: post.summary,
        snippet: buildSnippet(post.content, query),
        url: post.url,
        score,
      }));
  } catch {
    return [];
  }
}

export async function searchPosts(
  query: string,
  limit = 4
): Promise<SearchPostResult[]> {
  if (!query.trim()) return [];

  const vectorResults = await searchPostsByVector(query, limit);
  if (vectorResults.length > 0) return vectorResults;

  return searchPostsByKeyword(query, limit);
}

export function getPostBySlug(slug: string) {
  if (!slug) return null;

  const post = getCorpus().find((item) => item.slug === slug);
  if (!post) return null;

  return {
    slug: post.slug,
    title: post.title,
    publishedAt: post.publishedAt,
    summary: post.summary,
    url: post.url,
    content: post.content,
  };
}
