"use client";

import Giscus from "@giscus/react";
import { useComputedColorScheme } from "@mantine/core";

export function Comment() {
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

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
      theme={computedColorScheme === "dark" ? "dark_dimmed" : "light"}
      lang="ko"
    />
  );
}
