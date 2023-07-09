import {
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          id="map"
          style={{
            width: '100%',
            height: '500px',
            margin: '10px',
            border: '2px solid',
          }}
        />
        <Collapsible>
          <CollapsibleTrigger>Code</CollapsibleTrigger>
          <CollapsibleContent>
            <div dangerouslySetInnerHTML={{ __html: block }} />
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Comment />
    </>
  );
}
