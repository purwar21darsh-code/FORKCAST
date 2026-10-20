import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    ...props
  };
}

export function ForkMark({ size = 30, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 26V6" />
      <path d="M5 11h6.5c4.5 0 4.5 5 9 5H27" />
      <path d="M5 21h6.5c4.5 0 4.5-5 9-5" />
      <circle cx="5" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="27" cy="16" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="26" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5" />
      <path d="M12 17.2v.1" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function ToolIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14.5 6.5a4.5 4.5 0 0 0-6.6 5.4L3 17.2V21h3.8l5.3-4.9a4.5 4.5 0 0 0 5.4-6.6l-2.8 2.8-2.6-2.6 2.4-3.2Z" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h15" />
      <path d="m14 6 6 6-6 6" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 11a8 8 0 1 0-2.3 6.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 4.5 6v5.5c0 4.7 3.1 8 7.5 9.5 4.4-1.5 7.5-4.8 7.5-9.5V6L12 3Z" />
      <path d="m8.6 12 2.2 2.2 4.6-4.7" />
    </svg>
  );
}

export function BranchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="6" cy="5" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M6 7v3c0 3 2 4 5 4h5" />
      <path d="M16 8h-1c-3 0-4 2-4 5v3" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="10" width="14" height="11" rx="1.5" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
    </svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}

export function DatabaseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <ellipse cx="12" cy="5" rx="7" ry="2.6" />
      <path d="M5 5v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V5" />
      <path d="M5 11v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-6" />
    </svg>
  );
}
