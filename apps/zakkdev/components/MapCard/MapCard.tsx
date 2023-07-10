import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@zakkdev/ui';
import { MapCode } from '@zakkdev/types';
import { IssueBadge } from '@zakkdev/ui';
import Link from 'next/link';

interface Props {
  fileName: string;
  frontMatter: MapCode;
}
const MapCard = ({ fileName, frontMatter }: Props) => {
  return (
    <Card
      key={fileName}
      className="w-96 transform transition duration-150 hover:cursor-pointer hover:scale-105 hover:-translate-x-1 hover:-translate-y-1"
    >
      <Link href={`map/${fileName}`}>
        <CardHeader>
          <CardTitle className="m-0">{frontMatter?.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-ellipsis h-20">
          {frontMatter?.excerpt}
        </CardContent>
        <CardFooter>
          <IssueBadge status={frontMatter?.status} />
        </CardFooter>
      </Link>
    </Card>
  );
};

export default MapCard;
