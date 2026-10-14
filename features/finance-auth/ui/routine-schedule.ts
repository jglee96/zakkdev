export const ROUTINE_TIMEZONE_OPTIONS = [
  { value: "Asia/Seoul", label: "서울 (KST)" },
  { value: "America/New_York", label: "뉴욕 (EST)" },
  { value: "Europe/London", label: "런던 (GMT)" },
  { value: "Asia/Tokyo", label: "도쿄 (JST)" },
  { value: "UTC", label: "UTC" },
];

const TIMEZONE_LABELS: Record<string, string> = {
  "Asia/Seoul": "KST",
  "America/New_York": "EST",
  "Europe/London": "GMT",
  "Asia/Tokyo": "JST",
  UTC: "UTC",
};

export function formatCronSchedule(cronExpr: string, timezone: string): string {
  const parts = cronExpr.split(" ");
  if (parts.length < 5) return cronExpr;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const tzLabel = TIMEZONE_LABELS[timezone] || timezone;

  const dayNames: Record<string, string> = {
    "0": "일",
    "1": "월",
    "2": "화",
    "3": "수",
    "4": "목",
    "5": "금",
    "6": "토",
    "7": "일",
  };

  let schedule = "";

  if (dayOfWeek === "*" && dayOfMonth === "*" && month === "*") {
    schedule = "매일";
  } else if (dayOfWeek === "1-5" && dayOfMonth === "*" && month === "*") {
    schedule = "평일";
  } else if (dayOfWeek === "0,6" && dayOfMonth === "*" && month === "*") {
    schedule = "주말";
  } else if (dayOfWeek !== "*" && dayOfMonth === "*" && month === "*") {
    const days = dayOfWeek.split(",").map((d) => dayNames[d] || d).join(",");
    schedule = `매주 ${days}요일`;
  } else {
    schedule = cronExpr;
  }

  if (hour !== "*" && minute !== "*") {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const period = h < 12 ? "오전" : "오후";
    const displayHour = h % 12 || 12;
    schedule += ` ${period} ${displayHour}시`;
    if (m > 0) schedule += ` ${m}분`;
  }

  return `${schedule} (${tzLabel})`;
}
