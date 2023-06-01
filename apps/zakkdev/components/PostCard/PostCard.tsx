import { Card, Grid, Text } from '@nextui-org/react';
import dayjs from 'dayjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface Props {
  fileName: string;
}
const PostCard = ({ fileName }: Props) => {
  const router = useRouter();
  const [hover, setHover] = useState<boolean>(false);
  const file = fileName.split('.')[0];
  const [frontMatter, setFrontMatter] = useState<any>({
    title: file,
  });

  useEffect(() => {
    const params = {
      fileName: file,
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
    <Grid
      key={frontMatter.title}
      css={{ w: '$7xl', display: 'flex', justifyContent: 'center' }}
    >
      <Card
        isPressable
        isHoverable
        variant={hover ? 'bordered' : 'flat'}
        borderWeight="bold"
        css={{ w: '80%', h: '300px' }}
        onClick={() => {
          router.push(`blog/${file}`);
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
              src={`https://picsum.photos/seed/${file}/250/180`}
              objectFit="cover"
              width="100%"
              height="100%"
              alt={file}
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
            {frontMatter.title}
          </Text>
          <Text size="$sm">{dayjs(frontMatter.date).format('YYYY.MM.DD')}</Text>
        </Card.Footer>
      </Card>
    </Grid>
  );
};

export default PostCard;
