"use client";

import Script from "next/script";
import { Button, Flex } from "@mantine/core";
import { useRef } from "react";
import { InPolygon, OutPolygon, Polygon } from "./shape";

export default function Page() {
  const mapRef = useRef<naver.maps.Map | null>(null);
  return (
    <>
      <Flex columnGap="md" pb="md">
        <Button
          onClick={() =>
            new Polygon(mapRef.current!, {
              fillColor: "blue",
              fillOpacity: 0.3,
              strokeColor: "blue",
              strokeWeight: 3,
              strokeStyle: "shortdashdotdot",
            })
          }
        >
          Polygon
        </Button>
        <Button
          onClick={() =>
            new InPolygon(mapRef.current!, {
              fillColor: "orange",
              fillOpacity: 0.3,
              strokeColor: "orange",
              strokeWeight: 1,
            })
          }
        >
          InPolygon
        </Button>
        <Button
          onClick={() =>
            new OutPolygon(mapRef.current!, {
              fillColor: "green",
              fillOpacity: 0.3,
              strokeColor: "green",
              strokeWeight: 1,
            })
          }
        >
          OutPolygon
        </Button>
      </Flex>
      <div id="map" style={{ width: "100%", height: "80dvh" }} />
      <Script
        src={`https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}&submodules=drawing`}
        onReady={() => {
          mapRef.current = new naver.maps.Map("map");
        }}
      />
    </>
  );
}
