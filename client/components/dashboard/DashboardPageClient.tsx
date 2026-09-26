"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { ApiError, apiGet, type ActivityLog, type PatientStatus } from "@/lib/api";
import { cn } from "@/lib/cn";

type DashboardStats = {
  patients_seen_today: number;
  therapists_on_duty: number;
  revenue_today: string | number;
  open_slots_today: number;
};

type CapacityItem = {
  therapist_id: number;
  therapist_name: string;
  specialty: string;
  total_slots: number;
  booked_slots: number;
  open_slots: number;
  booked_ratio: number;
};

type RecentPatient = {
  id: number;
  full_name: string;
  condition: string;
  therapist_name: string;
  package_name: string;
  status: PatientStatus;
};

type DashboardData = {
  date: string;
  stats: DashboardStats;
  capacity: CapacityItem[];
  recent_patients: RecentPatient[];
  recent_activity: ActivityLog[];
};

function statusLabel(status: PatientStatus): string {
  if (status === "on_hold") return "On hold";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusTone(status: PatientStatus): "success" | "neutral" {
  return status === "active" ? "success" : "neutral";
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

function activityTone(
  action: string,
): "success" | "danger" | "neutral" | "primary" {
  if (
    action.includes("deleted") ||
    action.includes("cancelled") ||
    action.includes("deactivated")
  ) {
    return "danger";
  }
  if (
    action.includes("created") ||
    action.includes("booked") ||
    action.includes("paid")
  ) {
    return "success";
  }
  if (action.includes("updated") || action.includes("completed")) {
    return "primary";
  }
  return "neutral";
}

export function DashboardPageClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiGet<DashboardData>("/api/v1/dashboard", true);
      setData(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = data?.stats;

  return (
    <>
      <AppTopBar
        title="Dashboard"
        description={
          data
            ? `Live clinic overview for ${data.date}`
            : "Live clinic overview for today"
        }
        actions={
          <Link href="/schedule">
            <Button>Book appointment</Button>
          </Link>
        }
      />

      <div className="space-y-6 p-6">
        {error ? (
          <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              {
                label: "Patients today",
                value: loading ? "…" : String(stats?.patients_seen_today ?? 0),
              },
              {
                label: "Therapists on duty",
                value: loading ? "…" : String(stats?.therapists_on_duty ?? 0),
              },
              {
                label: "Revenue today",
                value: loading
                  ? "…"
                  : Number(stats?.revenue_today ?? 0).toFixed(2),
              },
              {
                label: "Open slots",
                value: loading ? "…" : String(stats?.open_slots_today ?? 0),
              },
            ] as const
          ).map((stat) => (
            <Card key={stat.label}>
              <p className="text-sm text-text-secondary">{stat.label}</p>
              <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-text-primary">
                <span className="font-mono text-[1.65rem]">{stat.value}</span>
              </p>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <CardTitle>Therapist capacity</CardTitle>
              <StatusPill tone="primary">Today</StatusPill>
            </div>
            {loading ? (
              <p className="text-sm text-text-secondary">Loading capacity…</p>
            ) : !data?.capacity.length ? (
              <p className="text-sm text-text-secondary">
                No therapists on duty today.
              </p>
            ) : (
              <ul className="space-y-4">
                {data.capacity.map((item) => (
                  <li key={item.therapist_id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {item.therapist_name}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {item.specialty}
                        </p>
                      </div>
                      <p className="font-mono text-xs text-text-secondary">
                        {item.booked_slots}/{item.total_slots} booked
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-border/70">
                      <div
                        className={cn(
                          "h-full rounded-full bg-primary transition-[width]",
                        )}
                        style={{
                          width: `${Math.min(item.booked_ratio * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      {item.open_slots} open slot
                      {item.open_slots === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <CardTitle>Recent patients</CardTitle>
              <Link
                href="/patients"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            {loading ? (
              <p className="px-5 py-6 text-sm text-text-secondary">Loading…</p>
            ) : !data?.recent_patients.length ? (
              <p className="px-5 py-6 text-sm text-text-secondary">
                No patients yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recent_patients.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/patients/${p.id}`}
                      className="flex flex-col gap-1 px-5 py-3 transition-colors hover:bg-background/80 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {p.full_name}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {p.condition} · {p.therapist_name} · {p.package_name}
                        </p>
                      </div>
                      <StatusPill tone={statusTone(p.status)}>
                        {statusLabel(p.status)}
                      </StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <CardTitle>Recent activity</CardTitle>
              <Link
                href="/activity"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            {loading ? (
              <p className="px-5 py-6 text-sm text-text-secondary">Loading…</p>
            ) : !(data?.recent_activity?.length) ? (
              <p className="px-5 py-6 text-sm text-text-secondary">
                No activity logged yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recent_activity.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <StatusPill tone={activityTone(row.action)}>
                          {formatAction(row.action)}
                        </StatusPill>
                        <span className="font-mono text-[11px] text-text-secondary">
                          {formatWhen(row.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-text-primary">{row.summary}</p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {row.actor_name ?? "System"}
                        {" · "}
                        {row.entity_type}
                        {row.entity_id != null ? ` #${row.entity_id}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
