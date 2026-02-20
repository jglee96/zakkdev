import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { config } from "dotenv";
import { getBlogPosts } from "../entities/post/lib/read-posts";
import type { PostEmbeddingIndex } from "../entities/post/model/types";

const localEnvPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(localEnvPath)) {
  config({ path: localEnvPath });
} else {
  config();
}

const OUTPUT_PATH = path.join(
  process.cwd(),
  "shared",
  "vector",
  "post-embeddings.json"
);
const MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const BATCH_SIZE = 20;

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

function toEmbeddingInput(post: ReturnType<typeof getBlogPosts>[number]) {
  const title = post.metadata.title ?? post.slug;
  const summary = post.metadata.summary ?? "";
  const content = stripMarkdown(post.content).slice(0, 6000);

  return `Title: ${title}\nSummary: ${summary}\nContent: ${content}`;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY가 설정되어 있지 않습니다.");
    process.exit(1);
  }

  const posts = getBlogPosts();
  if (posts.length === 0) {
    console.error("임베딩할 포스트가 없습니다.");
    process.exit(1);
  }

  const inputs = posts.map(toEmbeddingInput);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const embeddings: number[][] = [];

  for (let start = 0; start < inputs.length; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE, inputs.length);
    const batch = inputs.slice(start, end);

    const response = await client.embeddings.create({
      model: MODEL,
      input: batch,
    });

    embeddings.push(...response.data.map((item) => item.embedding));
    console.log(`embedded ${end}/${inputs.length}`);
  }

  const items = posts
    .map((post, index) => {
      const embedding = embeddings[index];
      if (!embedding || embedding.length === 0) return null;

      const title = post.metadata.title ?? post.slug;
      const summary = post.metadata.summary ?? "";
      const publishedAt = post.metadata.publishedAt ?? "";

      return {
        slug: post.slug,
        title,
        publishedAt,
        summary,
        url: `/blog/${post.slug}`,
        embedding,
      };
    })
    .filter(
      (
        item
      ): item is {
        slug: string;
        title: string;
        publishedAt: string;
        summary: string;
        url: string;
        embedding: number[];
      } => Boolean(item)
    );

  if (items.length === 0) {
    console.error("생성된 임베딩이 없습니다.");
    process.exit(1);
  }

  const index: PostEmbeddingIndex = {
    model: MODEL,
    dimensions: items[0].embedding.length,
    createdAt: new Date().toISOString(),
    items,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2), "utf-8");

  console.log(`wrote ${items.length} embeddings to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("임베딩 생성 실패:", error);
  process.exit(1);
});
