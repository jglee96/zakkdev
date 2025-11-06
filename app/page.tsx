import { Space, Text, Title } from "@mantine/core";
import classes from "./page.module.css";
import { getBlogPosts } from "@/utils/blog";
import { BlogListItem } from "@/components/blog";

export default async function Home() {
  const posts = getBlogPosts();

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
      {posts
        ?.slice(0, 3)
        .map(({ metadata: { title, publishedAt, summary, tags }, slug }) => (
          <BlogListItem
            key={slug}
            title={title}
            publishedAt={publishedAt}
            slug={slug}
            tags={tags}
            summary={summary}
          />
        ))}
    </>
  );
}
