"use client";

import dynamic from "next/dynamic";

export const CreateBotModal = dynamic(
  () => import("./create-bot-modal").then((mod) => mod.CreateBotModal),
  { ssr: false, loading: () => null },
);

export const BotDetailModal = dynamic(
  () => import("./bot-detail-modal").then((mod) => mod.BotDetailModal),
  { ssr: false, loading: () => null },
);

export const RunDetailModal = dynamic(
  () => import("./run-detail-modal").then((mod) => mod.RunDetailModal),
  { ssr: false, loading: () => null },
);

export const CreateRoutineModal = dynamic(
  () => import("./create-routine-modal").then((mod) => mod.CreateRoutineModal),
  { ssr: false, loading: () => null },
);

export const RoutineDetailModal = dynamic(
  () => import("./routine-detail-modal").then((mod) => mod.RoutineDetailModal),
  { ssr: false, loading: () => null },
);
