import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, ClockIcon, XIcon } from "./Icons";

export type BadgeTone = "success" | "danger" | "warning" | "info" | "neutral" | "running";

const labels: Record<BadgeTone, string> = {
  success: "Passed",
  danger: "Failed",
  warning: "Warning",
  info: "Info",
  neutral: "Idle",
  running: "Working"
};

export function StatusBadge({
  tone,
  children,
  icon = true
}: {
  tone: BadgeTone;
  children?: ReactNode;
  icon?: boolean;
}) {
  return (
    <span className={"status-badge status-" + tone}>
      {icon ? (
        tone === "success" ? (
          <CheckIcon size={13} />
        ) : tone === "danger" ? (
          <XIcon size={13} />
        ) : tone === "warning" ? (
          <AlertIcon size={13} />
        ) : (
          <ClockIcon size={13} />
        )
      ) : null}
      <span>{children ?? labels[tone]}</span>
    </span>
  );
}
