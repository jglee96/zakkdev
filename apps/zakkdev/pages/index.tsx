import { getParsedFileContentBySlug, markdownToHtml } from '@zakkdev/markdown';
import { GetServerSideProps } from 'next/types';

interface Props {
  html: string;
}

export function Index({ html }: Props) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export default Index;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  // 1. parse the content of our markdown and separate it into frontmatter and content
  const articleMarkdownContent = getParsedFileContentBySlug(
    'profile',
    '_articles/'
  );

  // 2. copnver markdown content => HTML
  const renderHTML = await markdownToHtml(articleMarkdownContent.content);

  return {
    props: {
      html: renderHTML,
    },
  };
};
