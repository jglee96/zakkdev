'use client';

import Giscus from '@giscus/react';

export function Comment() {
  return (
    <Giscus
      repo="jglee96/zakkdev"
      repoId="R_kgDOJd6uuQ"
      category="General"
      categoryId="DIC_kwDOJd6uuc4CXA8k"
      mapping="pathname"
      strict="0"
      reactionsEnabled="1"
      emitMetadata="0"
      inputPosition="top"
      theme={'light'}
      lang="ko"
      loading="lazy"
    />
  );
}
