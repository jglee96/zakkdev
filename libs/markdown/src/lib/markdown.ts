import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypePrism from 'rehype-prism-plus';
import rehypeStringify from 'rehype-stringify';
import { join } from 'path';
import { readFileSync } from 'fs';
import matter = require('gray-matter');
import { readdir } from 'fs';

export function getParsedFileContentBySlug(
  fileName: string,
  postsPath: string
) {
  const postFilePath = join(postsPath, `${fileName}.mdx`);
  const fileContent = readFileSync(postFilePath);

  const { data, content } = matter(fileContent);

  return {
    frontMatter: data,
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
