import { createClient } from "../supabase/server";

export const parseFile = async (fileName: string) => {
  const supabase = createClient();
  const { data: blob } = await supabase.storage
    .from("articles")
    .download(`${fileName}.mdx`);

  if (blob == null) {
    return "";
  }
  const file = await blob.text();
  return file;
};
