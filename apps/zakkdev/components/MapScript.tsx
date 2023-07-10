'use client';

import Script from 'next/script';

interface Props {
  code: string;
}

export default function MapScript({ code }: Props) {
  return (
    <Script
      type="text/javascript"
      src={`https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}&submodules=drawing`}
      onReady={() => new Function(code)()}
    />
  );
}
