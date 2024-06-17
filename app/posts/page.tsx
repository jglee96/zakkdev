import { Box, Text } from "@mantine/core";
import Link from "next/link";
import dayjs from "dayjs";
import { getDocPageMetas } from "@/utils/affine/reader";

export default async function Posts() {
  const metas = await getDocPageMetas();

  return (
    <>
      {metas?.map(({ title, id, created, excerpt }) => (
        <Box key={title} maw={840} my="md">
          <Text component={Link} href={`/posts/${id}`} fw={700} fz="xl">
            {title}
          </Text>
          <Text c="dimmed">{excerpt}</Text>
          <Text c="dimmed" fz="xs">
            {dayjs(created).format("YYYY-MM-DD")}
          </Text>
        </Box>
      ))}
    </>
  );
}
