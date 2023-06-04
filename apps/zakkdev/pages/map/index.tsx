import { Grid } from '@nextui-org/react';
import { readdirSync } from 'fs';
import { GetStaticProps } from 'next/types';
import MapCard from '../../components/MapCard/MapCard';

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
  const list = readdirSync(process.env.NEXT_PUBLIC_MAP_MARKDOWN_PATH);

  return {
    props: {
      map: list,
    },
  };
};
