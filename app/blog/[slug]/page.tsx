import type { Metadata } from "next";
import { getBlogPostMetadataBySlug } from "@/entities/post";
import {
  BlogPostPage,
  generateBlogPostStaticParams,
} from "@/views/blog-post";

const SITE_TITLE = "zakklee.dev";
const SITE_DESCRIPTION = "Zakklee's Blog made with Next.js, Vercel";

export default function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <BlogPostPage params={params} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostMetadataBySlug(slug);

  if (!post) {
    return {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
    };
  }

  return {
    title: `${post.title} | ${SITE_TITLE}`,
    description: post.summary || SITE_DESCRIPTION,
  };
}

export async function generateStaticParams() {
  return generateBlogPostStaticParams();
}
