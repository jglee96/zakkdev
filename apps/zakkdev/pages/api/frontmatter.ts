import { parseFile } from '@zakkdev/markdown';
import { NextApiRequest, NextApiResponse } from 'next';

const frontmatter = (req: NextApiRequest, res: NextApiResponse) => {
  const { fileName } = req.query;
  if (typeof fileName !== 'string') {
    res
      .status(500)
      .json({ statusCode: 500, message: 'fileName is not string' });
    return;
  }

  const { data } = parseFile(
    fileName,
    process.env.NEXT_PUBLIC_ARTICLE_MARKDOWN_PATH
  );

  res.status(200).json(data);
};

export default frontmatter;
