import { Badge, Box, Group, Text } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import dayjs from "dayjs";
import Link from "next/link";

interface Props {
  title: string;
  publishedAt: string;
  slug: string;
  summary?: string;
  tags?: string[];
}
export function BlogListItem({
  title,
  summary,
  publishedAt,
  slug,
  tags,
}: Props) {
  return (
    <Box maw={840} my="md">
      <Text component={Link} href={`/blog/${slug}`} fw={700} fz="xl">
        {title}
      </Text>
      {summary && (
        <Group gap={4} mt={4} align="flex-start">
          <Badge
            size="xs"
            variant="light"
            color="blue"
            leftSection={<IconSparkles size={10} />}
          >
            AI 요약
          </Badge>
          <Text c="dimmed" fz="xs" style={{ flex: 1 }}>
            {summary}
          </Text>
        </Group>
      )}
      <Group gap="xs" mt="xs">
        <Text c="dimmed" fz="xs">
          {dayjs(publishedAt).format("YYYY-MM-DD")}
        </Text>
        {tags && tags.length > 0 && (
          <>
            {tags.map((tag: string) => (
              <Badge
                key={tag}
                component={Link}
                href={buildUrl(tag)}
                size="xs"
                variant="light"
                style={{ cursor: "pointer" }}
              >
                {tag}
              </Badge>
            ))}
          </>
        )}
      </Group>
    </Box>
  );
}

function buildUrl(tag?: string) {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  const query = params.toString();
  return `/blog${query ? `?${query}` : ""}`;
}
