import { GetStaticProps } from 'next/types';
import { Container, Grid } from '@nextui-org/react';
import { Post } from '@zakkdev/types';
interface Props {
  posts: Post[];
}

export default function Blog({ posts }: Props) {
  return (
    <Container sm>
      <Grid.Container gap={2} alignContent="center">
        {posts.map((item, index) => (
          <PostCard key={index} item={item} index={index} />
        ))}
      </Grid.Container>
    </Container>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const posts = await prisma.post.findMany({
    take: 5,
  });

  return {
    props: {
      posts: JSON.parse(JSON.stringify(posts)),
    },
  };
};
