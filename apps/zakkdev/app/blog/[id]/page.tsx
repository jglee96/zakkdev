import { Comment } from '@zakkdev/ui';
import { parseFile } from '@/lib/parseFile';
import '@/styles/themes/prism-laserwave.css';
import { Metadata, ResolvingMetadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { compileMDX } from 'next-mdx-remote/rsc';

type Props = {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const id = params.id;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.from('blog').select().eq('file', id);

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

  return content;
}

export default async function Blog({ params }: { params?: Params }) {
  const post = await getPost(params);
  const { content } = await compileMDX({ source: post });

  return (
    <>
      {content}
      <Comment />
    </>
  );
}
