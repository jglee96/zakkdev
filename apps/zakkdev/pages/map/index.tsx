import { Grid } from '@nextui-org/react';
import { GetStaticProps } from 'next/types';
import MapCard from '../../components/MapCard/MapCard';
import { supabase } from '../../lib/supabase';
import { parseFile } from '../../lib/parseFile';
import { MapCode } from '@zakkdev/types';

interface Props {
  maps: {
    fileName: string;
    frontMatter: MapCode;
  }[];
}

export default function Map({ maps }: Props) {
  return (
    <Grid.Container gap={2} justify="flex-start" direction="column">
      {maps.map((item) => (
        <MapCard
          fileName={item.fileName}
          frontMatter={item.frontMatter}
          key={item.fileName}
        />
      ))}
    </Grid.Container>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const { data, error } = await supabase.storage.from('articles').list('map');

  if (error != null) {
    console.log(error);
    return {
      props: {
        maps: [],
      },
    };
  }
  const promises = data.map(async (file) => {
    const fileName = file.name.split('.')[0];
    const { data } = await parseFile(`map/${fileName}`);

    return { fileName, frontMatter: data as MapCode };
  });

  const list = await Promise.all(promises);

  return {
    props: {
      maps: list,
    },
  };
};
