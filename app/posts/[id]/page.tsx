import { Comment } from "@/components/comment";
import { parseFile } from "@/utils/mdx/parseFile";
import { createClient } from "@/utils/supabase/server";
import { Metadata, ResolvingMetadata } from "next";
import { compileMDX } from "next-mdx-remote/rsc";

import "@/themes/prism-laserwave.css";
import "@/themes/markdown.css";
import remarkGfm from "remark-gfm";

type Props = {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const id = params.id;

  const supabase = createClient();

  const { data, error } = await supabase.from("blog").select().eq("file", id);

  if (error != null) {
    console.log(error);
    return {};
  }

  return {
    title: data[0].title,
    description: data[0].description,
    openGraph: {
      title: data[0].title,
      description: data[0].description,
    },
  };
}

interface Params {
  id: string;
}

async function getPost(params?: Params) {
  const id = params?.id;

  if (typeof id !== "string") {
    return "";
  }
  const content = await parseFile(`posts/${id}`);

  return content;
}

export default async function Page({ params }: { params?: Params }) {
  const post = await getPost(params);
  const { content } = await compileMDX({
    source: post,
    options: {
      parseFrontmatter: true,
      mdxOptions: { remarkPlugins: [remarkGfm] },
    },
  });

  return (
    <>
      {content}
      <Comment />
    </>
  );
}
