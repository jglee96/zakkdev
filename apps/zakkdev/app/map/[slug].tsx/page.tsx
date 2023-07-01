import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@zakkdev/ui';
import { markdownToHtml } from '@zakkdev/markdown';
import { Comment } from '@zakkdev/ui';
import { transpile } from 'typescript';
import Script from 'next/script';
import { parseFile } from '../../../lib/parseFile';

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
      <Script
        type="text/javascript"
        src={`https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}&submodules=drawing`}
        onReady={() => new Function(code)()}
      />
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
