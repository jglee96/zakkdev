import { Card, CardContent, CardFooter, CardHeader } from '@zakkdev/ui';
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
      className="w-96 h-44 transform transition duration-150 hover:cursor-pointer hover:scale-105 hover:-translate-x-1 hover:-translate-y-1"
    >
      <Link href={`map/${fileName}`}>
        <CardHeader>
          <title>{frontMatter?.title}</title>
        </CardHeader>
        <CardContent>
          <p>{frontMatter?.excerpt}</p>
        </CardContent>
        <CardFooter>
          <IssueBadge status={frontMatter?.status} />
        </CardFooter>
      </Link>
    </Card>
  );
};

export default MapCard;
