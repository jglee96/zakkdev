import { GetStaticProps } from 'next/types';
import { Container, Grid } from '@nextui-org/react';
import { readdirSync } from 'fs';
import PostCard from '../../components/PostCard/PostCard';

interface Props {
  posts: string[];
}

export default function Blog({ posts }: Props) {
  return (
    <Container sm>
      <Grid.Container gap={2} alignContent="center">
        {posts.map((title, index) => (
          <PostCard key={index} fileName={title} />
        ))}
      </Grid.Container>
    </Container>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const list = readdirSync(process.env.NEXT_PUBLIC_ARTICLE_MARKDOWN_PATH);

  return {
    props: {
      posts: list,
    },
  };
};
