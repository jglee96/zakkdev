import { Card, CardContent, CardFooter } from '@zakkdev/ui';
import Image from 'next/image';
import { Post } from '@zakkdev/types';
import dayjs from 'dayjs';

interface Props {
  fileName: string;
  frontMatter: Post;
}
const PostCard = ({ fileName, frontMatter }: Props) => {
  return (
    <div key={fileName}>
      <Card>
        <CardContent>
          <Image
            width={250}
            height={180}
            src={`https://picsum.photos/seed/${fileName}/250/180`}
            alt={fileName}
          />
        </CardContent>
        <CardFooter>
          <p>{frontMatter?.title}</p>
          <p>{dayjs(frontMatter?.date).format('YYYY.MM.DD')}</p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PostCard;
