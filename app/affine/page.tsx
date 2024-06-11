import { Box, Text } from "@mantine/core";
import { getBlocksuiteReader } from "affine-reader";
import Link from "next/link";
import dayjs from "dayjs";

export default async function Affines() {
  const reader = getBlocksuiteReader({
    workspaceId: "834008fb-68de-4274-9f69-dbe8ae03d274",
  });
  const metadata = await reader.getDocPageMetas();

  return (
    <>
      {metadata
        ?.sort((a, b) => {
          const dateA =
            a.properties?.custom.find((c) => c.name === "created")?.value ??
            a.createDate;
          const dateB =
            b.properties?.custom.find((c) => c.name === "created")?.value ??
            b.createDate;
          return dayjs(dateB).valueOf() - dayjs(dateA).valueOf();
        })
        .map(({ title, id, createDate, properties }) => (
          <Box key={title} maw={840} my="md">
            <Text component={Link} href={`/affine/${id}`} fw={700} fz="xl">
              {title}
            </Text>
            <Text c="dimmed">
              {properties?.custom.find((c) => c.name === "excerpt")?.value}
            </Text>
            <Text c="dimmed" fz="xs">
              {dayjs(
                properties?.custom.find((c) => c.name === "created")?.value ??
                  createDate
              ).format("YYYY-MM-DD")}
            </Text>
          </Box>
        ))}
    </>
  );
}
