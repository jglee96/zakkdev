import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@zakkdev/ui';
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
      className="w-96 transform transition duration-150 hover:cursor-pointer hover:scale-105 hover:-translate-x-1 hover:-translate-y-1"
    >
      <Link href={`blog/${fileName}`}>
        <CardHeader>
          <CardTitle>{frontMatter.title}</CardTitle>
        </CardHeader>
        <CardContent className="h-20 text-ellipsis text-sm text-slate-500">
          {frontMatter.excerpt}
        </CardContent>
        <CardFooter className="flex flex-col items-start">
          <p className="text-sm">
            {dayjs(frontMatter?.date).format('YYYY.MM.DD')}
          </p>
        </CardFooter>
      </Link>
    </Card>
  );
};

export default PostCard;
