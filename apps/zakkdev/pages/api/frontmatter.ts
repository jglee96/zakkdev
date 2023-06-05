import { parseFile } from '../../lib/parseFile';
import { NextApiRequest, NextApiResponse } from 'next';

const frontmatter = async (req: NextApiRequest, res: NextApiResponse) => {
  const { fileName } = req.query;
  if (typeof fileName !== 'string') {
    res
      .status(500)
      .json({ statusCode: 500, message: 'fileName is not string' });
    return;
  }

  const { data } = await parseFile(fileName);

  res.status(200).json(data);
};

export default frontmatter;
