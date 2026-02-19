import { Space, Text, Title } from "@mantine/core";
import classes from "./home-page.module.css";
import { getBlogPosts, PostListItem } from "@/entities/post";

export async function HomePage() {
  const posts = getBlogPosts();

  return (
    <>
      <Title>zakklee</Title>
      <Space h="md" />
      <Text className={classes.summary} maw={840}>
        {
          "안녕하세요, 개발자 이종건입니다.\n이 블로그는 주로 웹 개발과 관련된 기술적인 내용을 다루지만, 개발 과정에서의 경험과 배움, 그리고 개인적인 생각과 일상도 함께 기록합니다.\n작업 중 마주한 문제와 해결 과정, 새롭게 배운 기술과 인사이트를 공유하며, 개발자로서의 성장 이야기도 담아가고 있습니다.\n방문해주셔서 감사하고, 읽는 분들께 작은 도움이 되길 바랍니다."
        }
      </Text>
      <Space h="xl" />
      <Title>Lastest Posts</Title>
      {posts
        ?.slice(0, 3)
        .map(({ metadata: { title, publishedAt, summary, tags }, slug }) => (
          <PostListItem
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
