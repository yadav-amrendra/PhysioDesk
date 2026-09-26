"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  apiDelete,
  apiGet,
  apiPut,
  type DayOverride,
  type DayOverridePayload,
  type Therapist,
} from "@/lib/api";

function toTimeInput(value: string | null): string {
  if (!value) return "09:00";
  return value.slice(0, 5);
}

export function ScheduleOverrideModal({
  open,
  therapist,
  onClose,
  onChanged,
}: {
  open: boolean;
  therapist: Therapist | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [overrides, setOverrides] = useState<DayOverride[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [overrideDate, setOverrideDate] = useState("");
  const [isDayOff, setIsDayOff] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");

  const load = useCallback(async () => {
    if (!therapist) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await apiGet<DayOverride[]>(
        `/api/v1/therapists/${therapist.id}/overrides`,
        true,
      );
      setOverrides(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overrides");
    } finally {
      setLoading(false);
    }
  }, [therapist]);

  useEffect(() => {
    if (!open || !therapist) return;
    setOverrideDate("");
    setIsDayOff(true);
    setStartTime("09:00");
    setEndTime("13:00");
    void load();
  }, [open, therapist, load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!therapist || !overrideDate) {
      setError("Pick a date for the override.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: DayOverridePayload = {
      override_date: overrideDate,
      is_day_off: isDayOff,
      start_time: isDayOff ? null : startTime,
      end_time: isDayOff ? null : endTime,
    };
    try {
      await apiPut(`/api/v1/therapists/${therapist.id}/overrides`, payload, true);
      await load();
      onChanged();
      setOverrideDate("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save override");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(overrideId: number) {
    if (!therapist) return;
    if (!window.confirm("Remove this schedule override?")) return;
    try {
      await apiDelete(
        `/api/v1/therapists/${therapist.id}/overrides/${overrideId}`,
        true,
      );
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove override");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule override"
      description={
        therapist
          ? `Day off or custom hours for ${therapist.full_name}`
          : undefined
      }
      className="max-w-xl"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-4 border-b border-border pb-5">
        <Input
          label="Date"
          type="date"
          value={overrideDate}
          onChange={(e) => setOverrideDate(e.target.value)}
          required
        />
        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={isDayOff}
            onChange={(e) => setIsDayOff(e.target.checked)}
            className="size-4 accent-primary"
          />
          Day off
        </label>
        {!isDayOff ? (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
            <Input
              label="End"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save override"}
          </Button>
        </div>
      </form>

      <div className="mt-5">
        <h3 className="mb-3 text-sm font-medium text-text-primary">
          Existing overrides
        </h3>
        {loading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : overrides.length === 0 ? (
          <p className="text-sm text-text-secondary">No overrides yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-[10px] border border-border">
            {overrides.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <div>
                  <span className="font-mono text-text-primary">
                    {row.override_date}
                  </span>
                  <span className="ml-2 text-text-secondary">
                    {row.is_day_off
                      ? "Day off"
                      : `${toTimeInput(row.start_time)} – ${toTimeInput(row.end_time)}`}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  className="h-8 px-2 text-status-danger"
                  onClick={() => void handleRemove(row.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p className="mt-4 rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
