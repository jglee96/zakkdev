import { Grid } from '@nextui-org/react';
import { GetStaticProps } from 'next/types';
import MapCard from '../../components/MapCard/MapCard';
import { supabase } from '../../lib/supabase';

interface Props {
  map: string[];
}

export default function Map({ map }: Props) {
  return (
    <Grid.Container gap={2} justify="flex-start" direction="column">
      {map.map((item) => (
        <MapCard fileName={item} key={item} />
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
        map: [],
      },
    };
  }

  return {
    props: {
      map: data.map((file) => file.name),
    },
  };
};
