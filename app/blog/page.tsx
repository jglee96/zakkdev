import { Text, Group, Badge, Stack } from "@mantine/core";
import Link from "next/link";
import { getBlogPosts, getAllTags } from "@/utils/blog";
import { BlogListItem, BlogPagination } from "@/components/blog";

const POSTS_PER_PAGE = 10;

function buildUrl(tag?: string) {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  const query = params.toString();
  return `/blog${query ? `?${query}` : ""}`;
}

export default async function Posts({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  const params = await searchParams;
  const allPosts = getBlogPosts();
  const allTags = getAllTags();
  const selectedTag = params.tag;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));

  // 태그로 필터링
  const filteredPosts = selectedTag
    ? allPosts.filter((post) => post.metadata.tags?.includes(selectedTag))
    : allPosts;

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const endIndex = startIndex + POSTS_PER_PAGE;
  const posts = filteredPosts.slice(startIndex, endIndex);

  return (
    <Stack gap="md">
      {/* 태그 필터 */}
      <Group gap="xs">
        <Text size="sm" fw={500}>
          태그:
        </Text>
        <Badge
          component={Link}
          href={buildUrl()}
          variant={!selectedTag ? "filled" : "light"}
          style={{ cursor: "pointer" }}
        >
          전체
        </Badge>
        {allTags.map((tag) => (
          <Badge
            key={tag}
            component={Link}
            href={buildUrl(tag)}
            variant={selectedTag === tag ? "filled" : "light"}
            style={{ cursor: "pointer" }}
          >
            {tag}
          </Badge>
        ))}
      </Group>

      <Stack gap={0}>
        {/* 포스트 목록 */}
        {posts.length > 0 ? (
          <>
            {posts.map(
              ({ metadata: { title, publishedAt, tags, summary }, slug }) => (
                <BlogListItem
                  key={slug}
                  title={title}
                  publishedAt={publishedAt}
                  slug={slug}
                  tags={tags}
                  summary={summary}
                />
              )
            )}

            {/* 페이지네이션 */}
            <BlogPagination
              total={totalPages}
              currentPage={currentPage}
              selectedTag={selectedTag}
            />
          </>
        ) : (
          <Text c="dimmed" ta="center" py="xl">
            포스트가 없습니다.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
