import { Title } from "@mantine/core";
import { getBlocksuiteReader } from "affine-reader";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { Comment } from "@/components/comment";

import "@/themes/prism-laserwave.css";
import "@/themes/markdown.css";

export default async function Page({ params }: { params: { id: string } }) {
  const reader = getBlocksuiteReader({
    workspaceId: "834008fb-68de-4274-9f69-dbe8ae03d274",
  });

  const affine = await reader.getDocMarkdown(params.id);
  if (affine === null) return <></>;
  const { content } = await compileMDX({
    source: affine.md,
    options: {
      mdxOptions: { remarkPlugins: [remarkGfm] },
    },
  });
  return (
    <>
      {/* <Title>{affine.title}</Title> */}
      <article>{content}</article>
      <Comment />
    </>
  );
}
