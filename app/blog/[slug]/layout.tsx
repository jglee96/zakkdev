import "@/themes/prism-laserwave.css";
import "@/themes/markdown.css";

import { Comment } from "@/components/comment";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div>{children}</div>
      <Comment />
    </>
  );
}
