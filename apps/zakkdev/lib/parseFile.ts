import * as matter from 'gray-matter';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export const parseFile = async (fileName: string) => {
  const supabase = createServerComponentClient({ cookies });
  const { data: blob } = await supabase.storage
    .from('articles')
    .download(`${fileName}.mdx`);

  if (blob == null) {
    return {
      data: '',
      content: '',
    };
  }
  const file = await blob.text();
  return matter.default(file);
};
