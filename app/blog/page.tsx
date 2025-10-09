import { Box, Text } from "@mantine/core";
import Link from "next/link";
import dayjs from "dayjs";
import { getBlogPosts } from "@/utils/blog";

export default async function Posts() {
  const posts = getBlogPosts();

  return (
    <>
      {posts.map(({ metadata: { title, publishedAt }, slug }) => (
        <Box key={title} maw={840} my="md">
          <Text component={Link} href={`/blog/${slug}`} fw={700} fz="xl">
            {title}
          </Text>
          <Text c="dimmed" fz="xs">
            {dayjs(publishedAt).format("YYYY-MM-DD")}
          </Text>
        </Box>
      ))}
    </>
  );
}
