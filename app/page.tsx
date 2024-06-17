import { Box, Space, Text, Title } from "@mantine/core";
import classes from "./page.module.css";
import { RESUME_DATA } from "@/data/resume-data";
import { getDocPageMetas } from "@/utils/affine/reader";
import Link from "next/link";
import dayjs from "dayjs";

interface Post {
  title: string;
  excerpt: string;
  date: string;
}

async function getLatestPosts() {
  const metas = await getDocPageMetas();

  return metas?.slice(0, 3);
}

export default async function Home() {
  const posts = await getLatestPosts();

  return (
    <>
      <Title>{RESUME_DATA.name}</Title>
      <Text className={classes.summary}>{RESUME_DATA.summary}</Text>
      <Space h="xl" />
      <Title>Lastest Posts</Title>
      {posts?.map(({ title, id, created, excerpt }) => (
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
