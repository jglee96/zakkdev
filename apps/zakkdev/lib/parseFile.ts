import * as matter from 'gray-matter';
import { supabase } from './supabase';

export const parseFile = async (fileName: string) => {
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
