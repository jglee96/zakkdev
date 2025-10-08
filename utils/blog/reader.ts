import dayjs from "dayjs";
import fs from "fs";
import path from "path";

function getMDXFiles(dir: string) {
  return fs
    .readdirSync(dir)
    .filter(
      (file) => path.extname(file) === ".mdx" || path.extname(file) === ".md"
    );
}

function readMDXFile(filePath: string) {
  let rawContent = fs.readFileSync(filePath, "utf-8");

  // 첫 번째 # 제목을 찾아서 title로 사용
  const titleMatch = rawContent.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1];

  // 파일명에서 날짜 추출 (YYYY-MM-DD 형식)
  const dateMatch = filePath.match(/\d{4}-\d{2}-\d{2}/);
  const publishedAt = dateMatch ? dateMatch[0] : "";

  return { metadata: { title, publishedAt }, content: rawContent };
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
