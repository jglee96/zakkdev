import * as matter from 'gray-matter';
import rehypePrism from 'rehype-prism-plus';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { join } from 'path';
import { readFileSync } from 'fs';
import { unified } from 'unified';

export function parseFile(fileName: string, postsPath: string) {
  const postFilePath = join(postsPath, `${fileName}.mdx`);
  const fileContent = readFileSync(postFilePath);

  const { data, content } = matter.default(fileContent);

  return {
    data,
    content,
  };
}

export async function markdownToHtml(markdown: string) {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypePrism)
    .use(rehypeStringify)
    .process(markdown);
  return result.toString();
}
