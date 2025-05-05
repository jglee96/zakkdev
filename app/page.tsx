import { Box, Space, Text, Title } from "@mantine/core";
import classes from "./page.module.css";
import { RESUME_DATA } from "@/data/resume-data";
import { getDocPageMetas } from "@/utils/affine/reader";
import Link from "next/link";
import dayjs from "dayjs";

async function getLatestPosts() {
  const metas = await getDocPageMetas();

  return metas?.slice(0, 3);
}

export default async function Home() {
  const posts = await getLatestPosts();

  return (
    <>
      <Title>zakklee</Title>
      <Space h="md" />
      <Text className={classes.summary} maw={840}>
        안녕하세요, 개발자 이종건입니다.
        <br />
        <br />웹 개발을 중심으로 더 나은 사용자 경험과 효율적인 코드를 고민하며
        다양한 프로젝트를 진행해 왔습니다. 이 블로그는 작업 중 마주한 문제와
        해결 과정을 기록하고, 유용한 기술을 공유하기 위해 만들어졌습니다.
        <br />
        <br />
        방문해주셔서 감사하고, 읽는 분들께 작은 도움이 되길 바랍니다.
      </Text>
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
