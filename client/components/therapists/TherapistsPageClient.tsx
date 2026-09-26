"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, CalendarClock, Trash2 } from "lucide-react";
import { ScheduleOverrideModal } from "@/components/therapists/ScheduleOverrideModal";
import { TherapistFormModal } from "@/components/therapists/TherapistFormModal";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  ApiError,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  type Therapist,
  type TherapistPayload,
} from "@/lib/api";

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

function formatDays(days: number[]): string {
  return days.map((d) => WEEKDAY_LABELS[d] ?? d).join(", ");
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

export function TherapistsPageClient() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Therapist | null>(null);
  const [overrideFor, setOverrideFor] = useState<Therapist | null>(null);
  const [deactivating, setDeactivating] = useState<Therapist | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (includeInactive) params.set("include_inactive", "true");
      const qs = params.toString();
      const rows = await apiGet<Therapist[]>(
        `/api/v1/therapists${qs ? `?${qs}` : ""}`,
        true,
      );
      setTherapists(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load therapists");
    } finally {
      setLoading(false);
    }
  }, [query, includeInactive]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function handleCreate(payload: TherapistPayload) {
    await apiPost<Therapist>("/api/v1/therapists", payload, true);
    await load();
  }

  async function handleUpdate(payload: TherapistPayload) {
    if (!editing) return;
    await apiPatch<Therapist>(`/api/v1/therapists/${editing.id}`, payload, true);
    await load();
  }

  async function handleDeactivateConfirm() {
    if (!deactivating) return;
    setConfirmBusy(true);
    try {
      await apiDelete(`/api/v1/therapists/${deactivating.id}`, true);
      setDeactivating(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deactivate");
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <>
      <AppTopBar
        title="Therapists"
        description="Roster, specialties, and working schedules (admin)"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add therapist
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <Card className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <Input
              label="Search"
              placeholder="Name or specialty"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <label className="mb-1 flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="size-4 accent-primary"
            />
            Show inactive
          </label>
        </Card>

        {error ? (
          <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-background/80 text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Specialty</th>
                  <th className="px-4 py-3 font-medium">Schedule</th>
                  <th className="px-4 py-3 font-medium">Weekly hrs</th>
                  <th className="px-4 py-3 font-medium">Seen today</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-text-secondary">
                      Loading roster…
                    </td>
                  </tr>
                ) : therapists.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-text-secondary">
                      No therapists found.
                    </td>
                  </tr>
                ) : (
                  therapists.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {t.full_name}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{t.specialty}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        <div>{formatDays(t.working_days)}</div>
                        <div className="font-mono text-xs">
                          {formatTime(t.default_start_time)}–
                          {formatTime(t.default_end_time)} · {t.slot_duration_minutes}m
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-text-primary">
                        {Number(t.weekly_hours).toFixed(1)}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-primary">
                        {t.patients_seen_today}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={t.is_active ? "success" : "neutral"}>
                          {t.is_active ? "Active" : "Inactive"}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            className="h-8 w-8 px-0"
                            title="Edit"
                            onClick={() => {
                              setEditing(t);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 shrink-0" />
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 px-0"
                            title="Schedule override"
                            onClick={() => setOverrideFor(t)}
                          >
                            <CalendarClock className="h-4 w-4 shrink-0" />
                          </Button>
                          {t.is_active ? (
                            <Button
                              variant="ghost"
                              className="h-8 w-8 px-0 text-status-danger"
                              title="Deactivate"
                              onClick={() => setDeactivating(t)}
                            >
                              <Trash2 className="h-4 w-4 shrink-0" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <TherapistFormModal
        open={formOpen}
        therapist={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={editing ? handleUpdate : handleCreate}
      />

      <ScheduleOverrideModal
        open={overrideFor !== null}
        therapist={overrideFor}
        onClose={() => setOverrideFor(null)}
        onChanged={() => void load()}
      />

      <ConfirmDialog
        open={deactivating !== null}
        title="Deactivate therapist?"
        description={
          deactivating
            ? `${deactivating.full_name} will leave the active roster. Existing appointments stay in place.`
            : ""
        }
        confirmLabel="Deactivate"
        busy={confirmBusy}
        onClose={() => {
          if (!confirmBusy) setDeactivating(null);
        }}
        onConfirm={handleDeactivateConfirm}
      />
    </>
  );
}
