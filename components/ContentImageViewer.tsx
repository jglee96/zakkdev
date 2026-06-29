"use client";

import { useState } from "react";
import { Modal } from "@mantine/core";

export function ContentImageViewer({ children }: { children: React.ReactNode }) {
  const [src, setSrc] = useState<string | null>(null);

  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "IMG") {
          setSrc((target as HTMLImageElement).src);
        }
      }}
      style={{ cursor: "auto" }}
    >
      {children}
      <Modal
        opened={!!src}
        onClose={() => setSrc(null)}
        size="auto"
        centered
        withCloseButton
        padding={0}
        styles={{ body: { display: "flex" } }}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            style={{
              width: "min(900px, 90vw)",
              height: "auto",
              maxHeight: "85vh",
              objectFit: "contain",
              display: "block",
            }}
          />
        )}
      </Modal>
    </div>
  );
}
