"use client";

export function ProjectNaverMapPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        top: "var(--app-shell-header-height, 64px)",
      }}
    >
      <iframe
        src="https://navermap-snap.vercel.app/"
        width="100%"
        height="100%"
        style={{ border: 0, display: "block" }}
      />
    </div>
  );
}
