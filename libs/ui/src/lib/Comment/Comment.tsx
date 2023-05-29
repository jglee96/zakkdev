import Giscus from '@giscus/react';
import { useTheme } from '@nextui-org/react';

export function Comment() {
  const { isDark } = useTheme();
  return (
    <Giscus
      repo="jglee96/markdown-blog-posts"
      repoId="R_kgDOJV79Fg"
      category="General"
      categoryId="DIC_kwDOJV79Fs4CV3dQ"
      mapping="pathname"
      strict="0"
      reactionsEnabled="1"
      emitMetadata="0"
      inputPosition="bottom"
      theme={isDark ? 'dark_dimmed' : 'light'}
      lang="ko"
      loading="lazy"
    />
  );
}
