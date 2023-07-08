import { markdownToHtml } from '@zakkdev/markdown';
import { Comment } from '@zakkdev/ui';
import { parseFile } from '@/lib/parseFile';
import '@/styles/themes/prism-laserwave.css';

interface Params {
  id: string;
}

async function getPost(params?: Params) {
  const id = params?.id;

  if (typeof id !== 'string') {
    return '';
  }
  const { content } = await parseFile(`posts/${id}`);

  const post = await markdownToHtml(content);

  return post;
}

export default async function Blog({ params }: { params?: Params }) {
  const post = await getPost(params);
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: post }} />
      <Comment />
    </>
  );
}
