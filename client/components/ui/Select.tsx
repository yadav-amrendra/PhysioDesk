import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export function Select({ label, className, id, children, ...props }: SelectProps) {
  const selectId = id ?? props.name;

  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label ? (
        <span className="font-medium text-text-primary">{label}</span>
      ) : null}
      <select
        id={selectId}
        className={cn(
          "h-10 rounded-[10px] border border-border bg-surface px-3 text-text-primary outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/20",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
