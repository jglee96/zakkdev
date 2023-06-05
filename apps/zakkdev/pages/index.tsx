import { markdownToHtml } from '@zakkdev/markdown';
import { GetServerSideProps } from 'next/types';
import { parseFile } from '../lib/parseFile';

interface Props {
  html: string;
}

export function Index({ html }: Props) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export default Index;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const { content } = await parseFile('profile');

  const renderHTML = await markdownToHtml(content);

  return {
    props: {
      html: renderHTML,
    },
  };
};
