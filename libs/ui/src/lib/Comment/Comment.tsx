import Giscus from '@giscus/react';
import { useTheme } from '@nextui-org/react';

export function Comment() {
  const { isDark } = useTheme();
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
      theme={isDark ? 'dark_dimmed' : 'light'}
      lang="ko"
      loading="lazy"
    />
  );
}
