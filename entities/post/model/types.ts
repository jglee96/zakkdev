export type PostMetadata = {
  title: string;
  publishedAt: string;
  tags?: string[];
  summary?: string;
};

export type Post = {
  metadata: PostMetadata;
  slug: string;
  content: string;
};

export type SearchPostResult = {
  slug: string;
  title: string;
  publishedAt: string;
  summary: string;
  snippet: string;
  url: string;
  score: number;
};

export type PostEmbeddingItem = {
  slug: string;
  title: string;
  publishedAt: string;
  summary: string;
  url: string;
  embedding: number[];
};

export type PostEmbeddingIndex = {
  model: string;
  dimensions: number;
  createdAt: string;
  items: PostEmbeddingItem[];
};
