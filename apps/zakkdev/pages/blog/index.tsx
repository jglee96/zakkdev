import { GetStaticProps } from 'next/types';
import { Container, Grid } from '@nextui-org/react';
import PostCard from '../../components/PostCard/PostCard';
import { supabase } from '../../lib/supabase';

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
  const { data, error } = await supabase.storage.from('articles').list('posts');

  if (error != null) {
    console.log(error);
    return {
      props: {
        posts: [],
      },
    };
  }

  return {
    props: {
      posts: data.map((file) => file.name),
    },
  };
};
