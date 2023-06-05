import { Card, Grid, Text } from '@nextui-org/react';
import { Post } from '@zakkdev/types';
import dayjs from 'dayjs';
import { useRouter } from 'next/router';
import { useState } from 'react';

interface Props {
  fileName: string;
  frontMatter: Post;
}
const PostCard = ({ fileName, frontMatter }: Props) => {
  const router = useRouter();
  const [hover, setHover] = useState<boolean>(false);

  return (
    <Grid
      key={fileName}
      css={{ w: '$7xl', display: 'flex', justifyContent: 'center' }}
    >
      <Card
        isPressable
        isHoverable
        variant={hover ? 'bordered' : 'flat'}
        borderWeight="bold"
        css={{ w: '80%', h: '300px' }}
        onClick={() => {
          router.push(`blog/${fileName}`);
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <Card.Body
          css={{
            p: '$lg',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Card css={{ w: '100%', h: '90%' }} variant="bordered">
            <Card.Image
              src={`https://picsum.photos/seed/${fileName}/250/180`}
              objectFit="cover"
              width="100%"
              height="100%"
              alt={fileName}
            />
          </Card>
        </Card.Body>
        <Card.Footer
          css={{
            p: 20,
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <Text b size="$md">
            {frontMatter?.title}
          </Text>
          <Text size="$sm">
            {dayjs(frontMatter?.date).format('YYYY.MM.DD')}
          </Text>
        </Card.Footer>
      </Card>
    </Grid>
  );
};

export default PostCard;
