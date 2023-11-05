import PostCard from '@/components/PostCard/PostCard';
import { Post } from '@zakkdev/types';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

async function getPosts() {
  const supabase = createServerComponentClient({ cookies });

  const { data, error } = await supabase
    .from('blog')
    .select('*')
    .order('created_at', { ascending: false })
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

export default async function Blog() {
  const posts = await getPosts();

  return (
    <div className="flex flex-wrap justify-center gap-x-24 gap-y-10">
      {posts.map((post, index) => (
        <PostCard
          fileName={post.file}
          frontMatter={post.frontmatter}
          key={post.file}
        />
      ))}
    </div>
  );
}
