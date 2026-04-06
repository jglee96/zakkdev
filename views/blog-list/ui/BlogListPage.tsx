import Link from "next/link";
import { getAllTags, getBlogPosts, PostListItem } from "@/entities/post";
import { BlogPagination } from "./BlogPagination";
import classes from "./blog-list-page.module.css";

const POSTS_PER_PAGE = 10;

function buildUrl(tag?: string) {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  const query = params.toString();
  return `/blog${query ? `?${query}` : ""}`;
}

export async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  const params = await searchParams;
  const allPosts = getBlogPosts();
  const allTags = getAllTags();
  const selectedTag = params.tag;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));

  const filteredPosts = selectedTag
    ? allPosts.filter((post) => post.metadata.tags?.includes(selectedTag))
    : allPosts;

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const endIndex = startIndex + POSTS_PER_PAGE;
  const posts = filteredPosts.slice(startIndex, endIndex);

  return (
    <div>
      <div className={classes.filterStrip}>
        <span className={classes.filterLabel}>Filter</span>
        <div className={classes.filterTags}>
          <Link
            href={buildUrl()}
            className={!selectedTag ? classes.tagActive : classes.tagInactive}
          >
            All
          </Link>
          {allTags.map((tag) => (
            <Link
              key={tag}
              href={buildUrl(tag)}
              className={
                selectedTag === tag ? classes.tagActive : classes.tagInactive
              }
            >
              {tag}
            </Link>
          ))}
        </div>
      </div>

      <div>
        {posts.length > 0 ? (
          <>
            {posts.map(
              ({ metadata: { title, publishedAt, tags, summary }, slug }) => (
                <PostListItem
                  key={slug}
                  title={title}
                  publishedAt={publishedAt}
                  slug={slug}
                  tags={tags}
                  summary={summary}
                />
              )
            )}
            <BlogPagination
              total={totalPages}
              currentPage={currentPage}
              selectedTag={selectedTag}
            />
          </>
        ) : (
          <p style={{ textAlign: "center", padding: "40px 0", color: "#5E5A56" }}>
            포스트가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
