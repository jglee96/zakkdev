import PostCard from '@/components/PostCard/PostCard';
import { supabase } from '@/lib/supabase';
import { parseFile } from '@/lib/parseFile';
import { Post } from '@zakkdev/types';

async function getPosts() {
  const { data, error } = await supabase.storage.from('articles').list('posts');

  if (error != null) {
    console.log(error);
    return [];
  }

  const promises = data.map(async (file) => {
    const fileName = file.name.split('.')[0];
    const { data } = await parseFile(`posts/${fileName}`);

    return { fileName, frontMatter: data as Post };
  });

  const list = await Promise.all(promises);

  return list;
}

export default async function Blog() {
  const posts = await getPosts();

  return (
    <div className="flex flex-wrap justify-center gap-x-24 gap-y-10">
      {posts.map((post, index) => (
        <PostCard
          fileName={post.fileName}
          frontMatter={post.frontMatter}
          key={post.fileName}
        />
      ))}
    </div>
  );
}
