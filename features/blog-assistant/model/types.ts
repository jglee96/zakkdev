export type AssistantSource = {
  title: string;
  url: string;
  publishedAt: string;
};

export type AskBlogResponse = {
  answer?: string;
  error?: string;
  sources?: AssistantSource[];
};
