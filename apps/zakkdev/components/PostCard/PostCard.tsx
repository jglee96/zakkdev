import { Card, CardContent, CardFooter } from '@zakkdev/ui';
import Image from 'next/image';
import { Post } from '@zakkdev/types';
import dayjs from 'dayjs';
import Link from 'next/link';

interface Props {
  fileName: string;
  frontMatter: Post;
}
const PostCard = ({ fileName, frontMatter }: Props) => {
  return (
    <Card
      key={fileName}
      className="w-64 h-72 transform transition duration-150 hover:cursor-pointer hover:scale-105 hover:-translate-x-1 hover:-translate-y-1"
    >
      <Link href={`blog/${fileName}`}>
        <CardContent className="pt-6">
          <Image
            className="rounded"
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
      </Link>
    </Card>
  );
};

export default PostCard;
