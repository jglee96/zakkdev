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
    >
      {children}
      <Modal
        opened={!!src}
        onClose={() => setSrc(null)}
        size="auto"
        centered
        radius={0}
        padding={0}
        withCloseButton={false}
        overlayProps={{ color: "#1C1917", backgroundOpacity: 0.72 }}
        styles={{
          content: {
            background: "#FDFCF9",
            border: "1px solid #C9C3B8",
            boxShadow: "none",
          },
          body: { display: "flex", flexDirection: "column" },
        }}
      >
        {src && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setSrc(null)}
              aria-label="닫기"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#86807A",
                fontSize: 18,
                lineHeight: 1,
                padding: "4px 8px",
                zIndex: 1,
                letterSpacing: "-0.5px",
              }}
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
          </div>
        )}
      </Modal>
    </div>
  );
}
