import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Input({ label, className, id, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label ? (
        <span className="font-medium text-text-primary">{label}</span>
      ) : null}
      <input
        id={inputId}
        className={cn(
          "h-10 rounded-[10px] border border-border bg-surface px-3 text-text-primary outline-none transition-shadow placeholder:text-text-secondary/70 focus:border-primary focus:ring-2 focus:ring-primary/20",
          className,
        )}
        {...props}
      />
    </label>
  );
}
