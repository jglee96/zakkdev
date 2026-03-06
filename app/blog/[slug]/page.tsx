import {
  BlogPostPage,
  generateBlogPostStaticParams,
} from "@/views/blog-post";

export default function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <BlogPostPage params={params} />;
}

export async function generateStaticParams() {
  return generateBlogPostStaticParams();
}
