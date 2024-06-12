import { WorkspacePage, getBlocksuiteReader } from "affine-reader";
import dayjs from "dayjs";

export function getAffineReader() {
  const reader = getBlocksuiteReader({
    workspaceId: process.env.NEXT_PUBLIC_AFFINE_WORKSPACE_ID!,
  });

  return reader;
}

export async function getDocPageMetas() {
  const reader = getAffineReader();
  const metas = await reader.getDocPageMetas();

  return metas
    ?.filter((p) => !p.trash)
    .map((p): WorkspacePage & { created?: string; excerpt?: string } => ({
      ...p,
      created:
        p.properties?.custom.find((c) => c.name === "created")?.value ??
        p.createDate,
      excerpt: p.properties?.custom.find((c) => c.name === "excerpt")?.value,
    }))
    ?.sort((a, b) => dayjs(b.created).valueOf() - dayjs(a.created).valueOf());
}

export async function getDocMarkdown(id: string) {
  const reader = getAffineReader();
  const doc = await reader.getDocMarkdown(id);

  return doc;
}
