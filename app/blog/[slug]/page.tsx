export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { default: Content } = await import(`@/content/${slug}.mdx`);

  return <Content />;
}

export async function generateStaticParams() {
  return [{ slug: "2023-02-07" }];
}
