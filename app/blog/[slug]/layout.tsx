import "@/shared/styles/prism-laserwave.css";
import "@/shared/styles/markdown.css";

import { CommentSection } from "@/widgets/comment-section";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CommentSection />
    </>
  );
}
