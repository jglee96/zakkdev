import {
  IconActivity,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconPlayerPause,
  IconX,
} from "@tabler/icons-react";
import type { RunStatus } from "../store/finance-store";

export const RUN_STATUS_CONFIG: Record<
  RunStatus,
  { color: string; label: string; icon: typeof IconCheck }
> = {
  queued: { color: "blue", label: "대기중", icon: IconClock },
  running: { color: "cyan", label: "실행중", icon: IconActivity },
  completed: { color: "green", label: "완료", icon: IconCheck },
  failed: { color: "red", label: "실패", icon: IconX },
  canceled: { color: "gray", label: "취소됨", icon: IconPlayerPause },
  timeout: { color: "orange", label: "시간초과", icon: IconAlertTriangle },
};

export const RUN_ERROR_CODE_LABELS: Record<string, string> = {
  MAX_ATTEMPTS: "최대 시도 횟수 초과",
  BUDGET_EXCEEDED: "예산 초과",
  BOT_NOT_FOUND: "봇 없음",
  BOT_INACTIVE: "봇 비활성",
  TIMEOUT: "시간 초과",
};
