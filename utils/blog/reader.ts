import dayjs from "dayjs";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

function getMDXFiles(dir: string) {
  return fs
    .readdirSync(dir)
    .filter(
      (file) => path.extname(file) === ".mdx" || path.extname(file) === ".md"
    );
}

function readMDXFile(filePath: string) {
  let rawContent = fs.readFileSync(filePath, "utf-8");

  const { data, content } = matter(rawContent);

  // frontmatter에서 title이 있으면 사용, 없으면 첫 번째 # 제목 사용
  let title = data.title;
  if (!title) {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    title = titleMatch?.[1] || "";
  }

  // 파일명에서 날짜 추출 (YYYY-MM-DD 형식)
  const dateMatch = filePath.match(/\d{4}-\d{2}-\d{2}/);
  const publishedAt = dateMatch ? dateMatch[0] : data.publishedAt || "";

  // tags 추출 (frontmatter에서 가져오거나 빈 배열)
  const tags = data.tags || [];

  return {
    metadata: { title, publishedAt, tags },
    content: content.trim(), // frontmatter가 제거된 content
  };
}

function getMDXData(dir: string) {
  let mdxFiles = getMDXFiles(dir);
  const datas = mdxFiles.map((file) => {
    let { metadata, content } = readMDXFile(path.join(dir, file));
    let slug = path.basename(file, path.extname(file));

    return {
      metadata,
      slug,
      content,
    };
  });

  return datas.sort((a, b) =>
    dayjs(b.metadata.publishedAt).diff(dayjs(a.metadata.publishedAt))
  );
}

export function getBlogPosts() {
  return getMDXData(path.join(process.cwd(), "content"));
}

// 모든 태그 목록 가져오기
export function getAllTags() {
  const posts = getBlogPosts();
  const tagSet = new Set<string>();

  posts.forEach((post) => {
    post.metadata.tags?.forEach((tag: string) => tagSet.add(tag));
  });

  return Array.from(tagSet).sort();
}

// 특정 태그로 필터링
export function getBlogPostsByTag(tag: string) {
  return getBlogPosts().filter((post) => post.metadata.tags?.includes(tag));
}
