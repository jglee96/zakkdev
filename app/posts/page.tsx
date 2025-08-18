import { Box, Text } from "@mantine/core";
import Link from "next/link";
import dayjs from "dayjs";
import { getDocPageMetas } from "@/utils/affine/reader";

// affine-reader가 revalidate: 0을 사용하므로 동적 렌더링 필요
export const dynamic = "force-dynamic";

export default async function Posts() {
  const metas = await getDocPageMetas();

  return (
    <>
      {metas?.map(({ title, id, createDate }) => (
        <Box key={title} maw={840} my="md">
          <Text component={Link} href={`/posts/${id}`} fw={700} fz="xl">
            {title}
          </Text>
          <Text c="dimmed" fz="xs">
            {dayjs(createDate).format("YYYY-MM-DD")}
          </Text>
        </Box>
      ))}
    </>
  );
}
