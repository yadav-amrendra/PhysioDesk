import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type StatusTone = "success" | "danger" | "neutral" | "primary";

const tones: Record<StatusTone, string> = {
  success: "bg-status-success-soft text-status-success",
  danger: "bg-status-danger-soft text-status-danger",
  neutral: "bg-status-neutral-soft text-status-neutral",
  primary: "bg-primary-soft text-primary-text-on-soft",
};

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
