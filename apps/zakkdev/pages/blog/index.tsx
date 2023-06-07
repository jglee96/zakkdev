import { GetStaticProps } from 'next/types';
import { Container, Grid } from '@nextui-org/react';
import PostCard from '../../components/PostCard/PostCard';
import { supabase } from '../../lib/supabase';
import { parseFile } from '../../lib/parseFile';
import { Post } from '@zakkdev/types';

interface Props {
  posts: {
    fileName: string;
    frontMatter: Post;
  }[];
}

export default function Blog({ posts }: Props) {
  return (
    <Grid.Container gap={2} alignContent="center" justify="center">
      {posts.map((post, index) => (
        <PostCard
          fileName={post.fileName}
          frontMatter={post.frontMatter}
          key={post.fileName}
        />
      ))}
    </Grid.Container>
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

  const promises = data.map(async (file) => {
    const fileName = file.name.split('.')[0];
    const { data } = await parseFile(`posts/${fileName}`);

    return { fileName, frontMatter: data as Post };
  });

  const list = await Promise.all(promises);

  return {
    props: {
      posts: list,
    },
  };
};
