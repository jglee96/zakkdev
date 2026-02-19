import { getBlogPosts } from "./read-posts";
import type { SearchPostResult } from "../model/types";

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

let cachedCorpus: SearchablePost[] | null = null;

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

export function searchPosts(query: string, limit = 4): SearchPostResult[] {
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
