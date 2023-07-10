import MapCard from '@/components/MapCard/MapCard';
import { supabase } from '@/lib/supabase';
import { parseFile } from '@/lib/parseFile';
import { MapCode } from '@zakkdev/types';

async function getMaps() {
  const { data, error } = await supabase.storage.from('articles').list('map');

  if (error != null) {
    console.log(error);
    return [];
  }
  const promises = data.map(async (file) => {
    const fileName = file.name.split('.')[0];
    const { data } = await parseFile(`map/${fileName}`);

    return { fileName, frontMatter: data as MapCode };
  });

  const list = await Promise.all(promises);

  return list;
}

export default async function Map() {
  const maps = await getMaps();

  return (
    <div className="flex flex-wrap justify-center gap-x-24 gap-y-10">
      {maps.map((item) => (
        <MapCard
          fileName={item.fileName}
          frontMatter={item.frontMatter}
          key={item.fileName}
        />
      ))}
    </div>
  );
}
