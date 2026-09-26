"use client";

import { useCallback, useEffect, useState } from "react";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { Select } from "@/components/ui/Select";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  ApiError,
  apiGet,
  type ActivityLog,
  type Paginated,
} from "@/lib/api";

const PAGE_SIZE = 20;

const ENTITY_OPTIONS = [
  { value: "", label: "All entities" },
  { value: "patient", label: "Patient" },
  { value: "appointment", label: "Appointment" },
  { value: "invoice", label: "Invoice" },
  { value: "therapist", label: "Therapist" },
  { value: "system", label: "System" },
] as const;

function actionTone(
  action: string,
): "success" | "danger" | "neutral" | "primary" {
  if (action.includes("deleted") || action.includes("cancelled") || action.includes("deactivated")) {
    return "danger";
  }
  if (action.includes("created") || action.includes("booked") || action.includes("paid")) {
    return "success";
  }
  if (action.includes("updated") || action.includes("completed")) {
    return "primary";
  }
  return "neutral";
}

function formatAction(action: string): string {
  return action
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" · ");
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityPageClient() {
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [query, setQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      if (query.trim()) params.set("q", query.trim());
      if (entityFilter) params.set("entity_type", entityFilter);
      const result = await apiGet<Paginated<ActivityLog>>(
        `/api/v1/activity?${params.toString()}`,
        true,
      );
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.total_pages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, [page, query, entityFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, entityFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <AppTopBar
        title="Activity"
        description="Audit trail of clinic actions — who changed what"
      />

      <div className="space-y-4 p-6">
        {error ? (
          <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3">
            <div className="min-w-[200px] flex-1">
              <Input
                label="Search"
                placeholder="Search summaries…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="w-44">
              <Select
                label="Entity"
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
              >
                {ENTITY_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {loading ? (
            <p className="px-4 py-8 text-sm text-text-secondary">Loading activity…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-sm text-text-secondary">
              No activity logged yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-background/60 text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Summary</th>
                    <th className="px-4 py-3 font-medium">Actor</th>
                    <th className="px-4 py-3 font-medium">Entity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-background/50">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-text-secondary">
                        {formatWhen(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={actionTone(row.action)}>
                          {formatAction(row.action)}
                        </StatusPill>
                      </td>
                      <td className="max-w-md px-4 py-3 text-text-primary">
                        {row.summary}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {row.actor_name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-text-secondary">
                        {row.entity_type}
                        {row.entity_id != null ? ` #${row.entity_id}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <PaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            disabled={loading}
          />
        </Card>
      </div>
    </>
  );
}
