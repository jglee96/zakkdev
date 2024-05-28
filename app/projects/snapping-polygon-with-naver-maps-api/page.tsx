"use client";

import { useRef } from "react";

export default function Page() {
  const mapRef = useRef<naver.maps.Map | null>(null);
  return (
    <iframe
      src="https://navermap-snap.vercel.app/"
      width="100%"
      height="100%"
      style={{ border: 0 }}
    />
  );
}
