import { IssueType } from '@zakkdev/types';
import { Badge } from '../shadcn/Badge';

interface Props {
  status?: IssueType;
}

export const IssueBadge = ({ status }: Props) => {
  let color: 'default' | 'success' | 'warning' | 'secondary' = 'default';
  switch (status) {
    case 'Open':
      color = 'success';
      break;
    case 'Fixing':
      color = 'warning';
      break;
    case 'Closed':
      color = 'secondary';
      break;
    case 'Writing':
    default:
      break;
  }

  return <Badge color={color}>{status}</Badge>;
};
