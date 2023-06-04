import { parseFile, markdownToHtml } from '@zakkdev/markdown';
import { GetStaticPaths, GetStaticProps } from 'next/types';
import { Comment } from '@zakkdev/ui';
import { transpile } from 'typescript';
import { Collapse } from '@nextui-org/react';
import Script from 'next/script';

interface Props {
  code: string;
  block: string;
}

export default function MapIssue({ code, block }: Props) {
  return (
    <>
      <Script
        type="text/javascript"
        src={`https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}&submodules=drawing`}
        onLoad={() => new Function(code)()}
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
        <Collapse
          shadow
          bordered
          title="Code"
          subtitle="Code used on the map"
          style={{
            width: '100%',
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: block }} />
        </Collapse>
      </div>
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
  const slug = params?.slug;

  if (typeof slug !== 'string') {
    return {
      props: {
        code: '',
        block: '',
      },
    };
  }
  const data = parseFile(slug, process.env.NEXT_PUBLIC_MAP_MARKDOWN_PATH);

  const code = transpile(data.content.split('\n').slice(2, -2).join('\n'));
  const block = await markdownToHtml(data.content);

  return {
    props: {
      code,
      block,
    },
  };
};
