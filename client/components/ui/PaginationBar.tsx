"use client";

import { Button } from "@/components/ui/Button";

type PaginationBarProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  disabled = false,
}: PaginationBarProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="font-mono text-xs text-text-secondary">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          className="h-8 px-3 text-xs"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="font-mono text-xs text-text-secondary">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="ghost"
          className="h-8 px-3 text-xs"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
