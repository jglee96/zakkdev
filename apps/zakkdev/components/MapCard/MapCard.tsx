import { Card, Grid, Text } from '@nextui-org/react';
import { MapCode } from '@zakkdev/types';
import { IssueBadge } from '@zakkdev/ui';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface Props {
  fileName: string;
}
const MapCard = ({ fileName }: Props) => {
  const router = useRouter();
  const file = fileName.split('.')[0];
  const [frontMatter, setFrontMatter] = useState<MapCode>();

  useEffect(() => {
    const params = {
      fileName: file,
      path: process.env.NEXT_PUBLIC_MAP_MARKDOWN_PATH,
    };
    const fetchFrontmatter = async () => {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_HOST}/api/frontmatter?${queryString}`
      );
      const data = await response.json();
      setFrontMatter(data);
    };

    fetchFrontmatter();
  }, []);

  return (
    <Grid key={file}>
      <Card
        isPressable
        onClick={() => {
          router.push(`map/${file}`);
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
