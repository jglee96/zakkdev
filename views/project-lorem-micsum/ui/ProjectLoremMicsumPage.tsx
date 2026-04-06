"use client";

export function ProjectLoremMicsumPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        top: "var(--app-shell-header-height, 64px)",
      }}
    >
      <iframe
        src="https://micsum.zakklee.dev/"
        width="100%"
        height="100%"
        style={{ border: 0, display: "block" }}
      />
    </div>
  );
}
