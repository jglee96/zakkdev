import { Card, CardContent, CardFooter, CardHeader } from '@zakkdev/ui';
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
      <Card className="w-64 h-72">
        <CardContent>
          <Image
            className="rounded mt-6"
            width={250}
            height={180}
            src={`https://picsum.photos/seed/${fileName}/250/180`}
            alt={fileName}
          />
        </CardContent>
        <CardFooter className="flex flex-col items-start">
          <p className="text-base font-bold">{frontMatter?.title}</p>
          <p className="text-sm">
            {dayjs(frontMatter?.date).format('YYYY.MM.DD')}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PostCard;
