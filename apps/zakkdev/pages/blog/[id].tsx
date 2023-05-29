import { getParsedFileContentBySlug, markdownToHtml } from '@zakkdev/markdown';
import { GetStaticPaths, GetStaticProps } from 'next/types';
import { Comment } from '@zakkdev/ui';

interface Props {
  posts: string;
}

export default function Blog({ posts }: Props) {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: posts }} />
      <Comment />
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const id = params?.id;

  if (typeof id !== 'string') {
    return {
      props: {
        posts: '',
      },
    };
  }
  const articleMarkdownContent = getParsedFileContentBySlug(id, '_articles/');

  const posts = await markdownToHtml(articleMarkdownContent.content);

  return {
    props: {
      posts,
    },
  };
};
