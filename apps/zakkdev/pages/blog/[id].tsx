import { parseFile, markdownToHtml } from '@zakkdev/markdown';
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
  const { content } = parseFile(
    id,
    process.env.NEXT_PUBLIC_ARTICLE_MARKDOWN_PATH
  );

  const posts = await markdownToHtml(content);

  return {
    props: {
      posts,
    },
  };
};
