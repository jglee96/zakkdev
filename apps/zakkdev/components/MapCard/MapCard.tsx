import { Card, CardContent, CardFooter, CardHeader } from '@zakkdev/ui';
import { MapCode } from '@zakkdev/types';
import { IssueBadge } from '@zakkdev/ui';

interface Props {
  fileName: string;
  frontMatter: MapCode;
}
const MapCard = ({ fileName, frontMatter }: Props) => {
  return (
    <div key={fileName}>
      <Card>
        <CardHeader>
          <title>{frontMatter?.title}</title>
        </CardHeader>
        <CardContent>
          <p>{frontMatter?.excerpt}</p>
        </CardContent>
        <CardFooter>
          <IssueBadge status={frontMatter?.status} />
        </CardFooter>
      </Card>
    </div>
  );
};

export default MapCard;
