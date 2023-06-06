import { Card, Grid, Text } from '@nextui-org/react';
import { MapCode } from '@zakkdev/types';
import { IssueBadge } from '@zakkdev/ui';
import { useRouter } from 'next/router';

interface Props {
  fileName: string;
  frontMatter: MapCode;
}
const MapCard = ({ fileName, frontMatter }: Props) => {
  const router = useRouter();

  return (
    <Grid key={fileName}>
      <Card
        isPressable
        isHoverable
        variant={'flat'}
        onClick={() => {
          router.push(`map/${fileName}`);
        }}
      >
        <Card.Header>
          <Text b>{frontMatter?.title}</Text>
        </Card.Header>
        <Card.Divider />
        <Card.Body>
          <Text>{frontMatter?.excerpt}</Text>
        </Card.Body>
        <Card.Divider />
        <Card.Footer>
          <IssueBadge status={frontMatter?.status} />
        </Card.Footer>
      </Card>
    </Grid>
  );
};

export default MapCard;
