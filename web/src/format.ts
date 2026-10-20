export function formatTime(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return hours12 + ":" + String(mins).padStart(2, "0") + " " + suffix;
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const rounded = Math.round(minutes);
  if (Math.abs(rounded) < 60) return rounded + " min";
  const hours = Math.trunc(rounded / 60);
  const mins = Math.abs(rounded % 60);
  return mins === 0 ? hours + " hr" : hours + " hr " + mins + " min";
}

export function formatDelta(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "unknown";
  if (minutes === 0) return "no change";
  return (minutes > 0 ? "+" : "") + minutes + " min";
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
export function shortId(value: string): string {
  const parts = value.split(/[-_]/).filter(Boolean);
  const tail = parts[parts.length - 1] ?? value;
  return tail.length > 10 ? tail.slice(-8) : tail;
}
