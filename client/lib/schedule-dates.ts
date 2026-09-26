/** Local-date helpers for the schedule calendar (no UTC shift). */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday-start
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

export function endOfWeek(iso: string): string {
  return addDays(startOfWeek(iso), 6);
}

export function startOfMonth(iso: string): string {
  const d = parseISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(iso: string): string {
  const d = parseISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Calendar cells for a month grid (Mon–Sun), including leading/trailing days. */
export function monthGridDays(iso: string): string[] {
  const start = startOfWeek(startOfMonth(iso));
  const end = endOfWeek(endOfMonth(iso));
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function weekDays(iso: string): string[] {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatMonthTitle(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function formatWeekTitle(iso: string): string {
  const start = parseISODate(startOfWeek(iso));
  const end = parseISODate(endOfWeek(iso));
  const left = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const right = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${left} – ${right}`;
}

export function formatDayTitle(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtTime(value: string): string {
  return value.slice(0, 5);
}

/** Minutes between two HH:MM[:SS] clock times on the same day. */
export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = fmtTime(start).split(":").map(Number);
  const [eh, em] = fmtTime(end).split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function weekdayShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { weekday: "short" });
}

export function dayNumber(iso: string): number {
  return parseISODate(iso).getDate();
}

export function sameMonth(a: string, b: string): boolean {
  const da = parseISODate(a);
  const db = parseISODate(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
}
