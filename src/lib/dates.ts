/**
 * Date and timezone utilities for CricketGeo.
 * Default time zone is Asia/Kolkata (IST), matching the official daily round schedule.
 */

export function getKolkataToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidDateFormat(dateStr: unknown): boolean {
  if (typeof dateStr !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parsed = Date.parse(`${dateStr}T00:00:00Z`);
  return !isNaN(parsed);
}

export function isPracticeDate(dateStr: string | null | undefined): boolean {
  return typeof dateStr === "string" && dateStr.startsWith("practice-");
}
