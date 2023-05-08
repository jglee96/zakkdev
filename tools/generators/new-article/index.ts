import {
  Tree,
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
} from '@nrwl/devkit';

interface NewAritlceSchemaOptions {
  title: string;
  author: string;
  excerpt?: string;
}

export default async function (tree: Tree, schema: NewAritlceSchemaOptions) {
  generateFiles(
    tree,
    joinPathFragments(__dirname, './files'),
    './_articles/mdx',
    {
      title: schema.title,
      author: schema.author,
      excerpt: schema.excerpt || '',
      normalizedTitle: names(schema.title).fileName,
      creationDate: new Date().toISOString(),
    }
  );
  await formatFiles(tree);
}
