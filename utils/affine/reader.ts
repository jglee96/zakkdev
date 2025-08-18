import { WorkspacePage, getBlocksuiteReader } from "affine-reader";
import dayjs from "dayjs";

export function getAffineReader() {
  const reader = getBlocksuiteReader({
    workspaceId: process.env.NEXT_PUBLIC_AFFINE_WORKSPACE_ID!,
  });

  return reader;
}

export async function getDocPageMetas() {
  try {
    const reader = getAffineReader();
    const metas = await reader.getDocPageMetas();

    if (!metas) {
      return [];
    }

    const filteredMetas = metas
      .filter((p) => !p.trash)
      .filter((p) => !p.properties?.tags.includes("hidden"))
      .sort((a, b) => b.createDate - a.createDate);

    return filteredMetas;
  } catch (error) {
    console.error("Failed to get doc page metas:", error);
    return [];
  }
}

export async function getDocMarkdown(id: string) {
  try {
    const reader = getAffineReader();
    const doc = await reader.getDocMarkdown(id);

    return doc;
  } catch (error) {
    console.error("Failed to get doc markdown:", error);
    return null;
  }
}
