import { Title } from "@mantine/core";
import { evaluate } from "next-mdx-remote-client/rsc";
import remarkGfm from "remark-gfm";
import { Comment } from "@/components/comment";
import { getDocMarkdown } from "@/utils/affine/reader";

import "@/themes/prism-laserwave.css";
import "@/themes/markdown.css";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const doc = await getDocMarkdown(params.id);

  if (doc === null) return <></>;
  const { content } = await evaluate({
    source: doc.md,
    options: {
      mdxOptions: { remarkPlugins: [remarkGfm] },
    },
  });
  return (
    <>
      <Title>{doc.title.toString()}</Title>
      <article>{content}</article>
      <Comment />
    </>
  );
}
