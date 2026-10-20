import type { Minutes } from "./types.js";

export function formatTime(minutes: Minutes | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return hours12 + ":" + String(mins).padStart(2, "0") + " " + suffix;
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return "—";
  const rounded = Math.round(minutes);
  if (rounded < 60) return rounded + " min";
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins === 0 ? hours + " hr" : hours + " hr " + mins + " min";
}

export function assertMinute(value: unknown, name: string): asserts value is Minutes {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= 1440) {
    throw new Error(name + " must be an integer minute after midnight (0..1439).");
  }
}
