import { createClient } from "@/utils/supabase/server";
import { Text, Title } from "@mantine/core";
import dayjs from "dayjs";

interface Post {
  title: string;
  excerpt: string;
  date: string;
}

async function getPosts() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("blog")
    .select("*")
    .order("created_at", { ascending: false })
    .range(0, 9);

  if (error != null) {
    console.log(error);
    return [];
  }

  const promises = data.map(
    async (item): Promise<{ file: string; frontmatter: Post }> => ({
      file: item.file,
      frontmatter: {
        title: item.title,
        excerpt: item.description,
        date: item.created_at,
      },
    })
  );

  const list = await Promise.all(promises);

  return list;
}

export default async function Posts() {
  const posts = await getPosts();

  return (
    <>
      {posts.map(({ frontmatter: { title, excerpt, date } }) => (
        <>
          <Title>{title}</Title>
          <Text>{excerpt}</Text>
          <Text>{dayjs(date).format("YYYY-MM-DD")}</Text>
        </>
      ))}
    </>
  );
}
