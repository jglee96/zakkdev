"use client";

import Script from "next/script";
import { Button, Flex } from "@mantine/core";
import { useRef } from "react";
import { InPolygon, OutPolygon, Polygon } from "./shape";

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
