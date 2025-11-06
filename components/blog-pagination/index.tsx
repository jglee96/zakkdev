"use client";

import { Pagination, Center } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BlogPaginationProps {
  total: number;
  currentPage: number;
  selectedTag?: string;
}

function buildUrl(tag?: string, page?: number) {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  if (page && page > 1) params.set("page", page.toString());
  const query = params.toString();
  return `/blog${query ? `?${query}` : ""}`;
}

export function BlogPagination({
  total,
  currentPage,
  selectedTag,
}: BlogPaginationProps) {
  const router = useRouter();
  if (total <= 1) return null;

  return (
    <Center mt="xl">
      <Pagination
        total={total}
        value={currentPage}
        getItemProps={(page) => ({
          component: Link,
          href: buildUrl(selectedTag, page),
        })}
        onChange={(page) => {
          router.push(buildUrl(selectedTag, page));
        }}
      />
    </Center>
  );
}
