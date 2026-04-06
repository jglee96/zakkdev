import dayjs from "dayjs";
import Link from "next/link";
import classes from "./post-list-item.module.css";

interface Props {
  title: string;
  publishedAt: string;
  slug: string;
  summary?: string;
  tags?: string[];
}

export function PostListItem({ title, summary, publishedAt, slug, tags }: Props) {
  return (
    <div className={classes.item}>
      <div className={classes.meta}>
        <span className={classes.date}>
          {dayjs(publishedAt).format("YYYY.MM.DD")}
        </span>
        {tags && tags.length > 0 && (
          <div className={classes.tags}>
            {tags.map((tag) => (
              <Link key={tag} href={buildUrl(tag)} className={classes.tag}>
                {tag}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className={classes.content}>
        <Link href={`/blog/${slug}`} className={classes.title}>
          {title}
        </Link>
        {summary && <p className={classes.summary}>{summary}</p>}
      </div>
    </div>
  );
}

function buildUrl(tag?: string) {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  const query = params.toString();
  return `/blog${query ? `?${query}` : ""}`;
}
