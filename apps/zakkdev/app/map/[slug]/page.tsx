import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@zakkdev/ui';
import { markdownToHtml } from '@zakkdev/markdown';
import { Comment } from '@zakkdev/ui';
import { transpile } from 'typescript';
import { parseFile } from '@/lib/parseFile';
import MapScript from '@/components/MapScript';
import '@/styles/themes/prism-laserwave.css';
import { Metadata, ResolvingMetadata } from 'next';
import { createClient } from '@supabase/supabase-js';

type Props = {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const slug = params.slug;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.from('map').select().eq('file', slug);

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
  slug: string;
}

async function getMap(params?: Params) {
  const slug = params?.slug;

  if (typeof slug !== 'string') {
    return {
      code: '',
      block: '',
    };
  }
  const { content } = await parseFile(`map/${slug}`);

  const code = transpile(content.split('\n').slice(2, -2).join('\n'));
  const block = await markdownToHtml(content);

  return {
    code,
    block,
  };
}

export default async function MapIssue({ params }: { params?: Params }) {
  const { code, block } = await getMap(params);

  return (
    <>
      <MapScript code={code} />
      <div className="flex flex-col items-center">
        <div
          id="map"
          className="w-full h-96 m-2 border-solid border-2 border-border"
        />
        <Collapsible className="w-full">
          <CollapsibleTrigger asChild>
            <Button>Code</Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-collaps-down data-[state=closed]:animate-collaps-up">
            <div dangerouslySetInnerHTML={{ __html: block }} />
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Comment />
    </>
  );
}
