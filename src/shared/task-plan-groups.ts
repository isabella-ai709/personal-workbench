import type { TaskPlan } from "./task-plan-contracts";

export type FocusGroup = "past_plan_time" | "today" | "blocked" | "next_seven_days" | "later";

function calendarDay(value: string | Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(value));
  const part = (type: "year" | "month" | "day") =>
    Number(parts.find((item) => item.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / 86_400_000;
}

export function getFocusGroup(
  taskPlan: TaskPlan,
  now = new Date(),
  timeZone = "Asia/Shanghai",
): FocusGroup | null {
  if (taskPlan.deletedAt || taskPlan.status === "completed" || taskPlan.type === "idea")
    return null;

  if (taskPlan.dueAt) {
    const difference = calendarDay(taskPlan.dueAt, timeZone) - calendarDay(now, timeZone);
    if (difference < 0) return "past_plan_time";
    if (difference === 0) return "today";
    if (taskPlan.status === "blocked") return "blocked";
    if (difference <= 7) return "next_seven_days";
    return "later";
  }

  return taskPlan.status === "blocked" ? "blocked" : "later";
}
