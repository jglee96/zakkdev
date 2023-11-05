import MapCard from '@/components/MapCard/MapCard';
import { MapCode } from '@zakkdev/types';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

async function getMaps() {
  const supabase = createServerComponentClient({ cookies });
  const { data, error } = await supabase
    .from('map')
    .select('*')
    .order('id')
    .range(0, 9);

  if (error != null) {
    console.log(error);
    return [];
  }
  const promises = data.map(
    async (item): Promise<{ file: string; frontmatter: MapCode }> => ({
      file: item.file,
      frontmatter: {
        title: item.title,
        excerpt: item.description,
        status: item.status,
      },
    })
  );

  const list = await Promise.all(promises);

  return list;
}

export default async function Map() {
  const maps = await getMaps();

  return (
    <div className="flex flex-wrap justify-center gap-x-24 gap-y-10">
      {maps.map((item) => (
        <MapCard
          fileName={item.file}
          frontMatter={item.frontmatter}
          key={item.file}
        />
      ))}
    </div>
  );
}
