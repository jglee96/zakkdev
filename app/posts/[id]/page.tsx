import { Title } from "@mantine/core";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { Comment } from "@/components/comment";
import { getDocMarkdown } from "@/utils/affine/reader";

import "@/themes/prism-laserwave.css";
import "@/themes/markdown.css";

export default async function Page({ params }: { params: { id: string } }) {
  const doc = await getDocMarkdown(params.id);

  if (doc === null) return <></>;
  const { content } = await compileMDX({
    source: doc.md,
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
