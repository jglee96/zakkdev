export interface Post {
  title: string;
  excerpt?: string;
  date: string;
}

export interface MapCode {
  title: string;
  excerpt: string;
  gist?: string;
  status: IssueType;
}

export type IssueType = 'Writing' | 'Open' | 'Fixing' | 'Closed';
