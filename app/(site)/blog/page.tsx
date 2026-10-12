import { BlogListPage } from "@/views/blog-list";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  return <BlogListPage searchParams={searchParams} />;
}
