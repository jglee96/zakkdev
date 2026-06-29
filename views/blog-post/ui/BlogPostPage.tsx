import { getBlogPosts } from "@/entities/post";
import { ContentImageViewer } from "@/components/ContentImageViewer";

export async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let Content: any = null;
  try {
    Content = await import(`@/content/${slug}.mdx`).then(
      (module) => module.default
    );
  } catch {
    Content = await import(`@/content/${slug}.md`).then(
      (module) => module.default
    );
  }

  return (
    <ContentImageViewer>
      <Content />
    </ContentImageViewer>
  );
}

export async function generateStaticParams() {
  const posts = getBlogPosts();
  return posts.map(({ slug }) => ({ slug }));
}
