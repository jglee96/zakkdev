import { markdownToHtml } from '@zakkdev/markdown';
import { Comment } from '@zakkdev/ui';
import { parseFile } from '@/lib/parseFile';
import '@/styles/themes/prism-laserwave.css';
import { Metadata, ResolvingMetadata } from 'next';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

type Props = {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const id = params.id;

  const supabase = createServerComponentClient({ cookies });

  const { data, error } = await supabase.from('blog').select().eq('id', id);

  if (error != null) {
    console.log(error);
    return {};
  }

  return {
    title: data[0].title,
    description: data[0].description,
    openGraph: {
      title: data[0].title,
      description: data[0].description,
    },
  };
}

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
