"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { Therapist, TherapistPayload } from "@/lib/api";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

function toTimeInput(value: string): string {
  // API may return HH:MM:SS
  return value.slice(0, 5);
}

type FormState = {
  full_name: string;
  specialty: string;
  working_days: number[];
  default_start_time: string;
  default_end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
};

const emptyForm: FormState = {
  full_name: "",
  specialty: "",
  working_days: [1, 2, 3, 4, 5],
  default_start_time: "09:00",
  default_end_time: "17:00",
  slot_duration_minutes: 30,
  is_active: true,
};

function fromTherapist(t: Therapist): FormState {
  return {
    full_name: t.full_name,
    specialty: t.specialty,
    working_days: [...t.working_days],
    default_start_time: toTimeInput(t.default_start_time),
    default_end_time: toTimeInput(t.default_end_time),
    slot_duration_minutes: t.slot_duration_minutes,
    is_active: t.is_active,
  };
}

export function TherapistFormModal({
  open,
  therapist,
  onClose,
  onSubmit,
}: {
  open: boolean;
  therapist: Therapist | null;
  onClose: () => void;
  onSubmit: (payload: TherapistPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = therapist !== null;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(therapist ? fromTherapist(therapist) : emptyForm);
  }, [open, therapist]);

  function toggleDay(day: number) {
    setForm((prev) => {
      const has = prev.working_days.includes(day);
      const working_days = has
        ? prev.working_days.filter((d) => d !== day)
        : [...prev.working_days, day].sort((a, b) => a - b);
      return { ...prev, working_days };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.full_name.trim() || !form.specialty.trim()) {
      setError("Name and specialty are required.");
      return;
    }
    if (form.working_days.length === 0) {
      setError("Select at least one working day.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        full_name: form.full_name.trim(),
        specialty: form.specialty.trim(),
        working_days: form.working_days,
        default_start_time: form.default_start_time,
        default_end_time: form.default_end_time,
        slot_duration_minutes: Number(form.slot_duration_minutes),
        is_active: form.is_active,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save therapist");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit therapist" : "Add therapist"}
      description="Name, specialty, weekly schedule, and slot length"
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Full name"
          value={form.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          required
        />
        <Input
          label="Specialty"
          value={form.specialty}
          onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
          required
        />

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-text-primary">
            Working days
          </legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const active = form.working_days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={
                    active
                      ? "rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary-text-on-soft"
                      : "rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary"
                  }
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start time"
            type="time"
            value={form.default_start_time}
            onChange={(e) =>
              setForm((f) => ({ ...f, default_start_time: e.target.value }))
            }
            required
          />
          <Input
            label="End time"
            type="time"
            value={form.default_end_time}
            onChange={(e) =>
              setForm((f) => ({ ...f, default_end_time: e.target.value }))
            }
            required
          />
        </div>

        <Input
          label="Slot duration (minutes)"
          type="number"
          min={5}
          max={180}
          step={5}
          value={form.slot_duration_minutes}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              slot_duration_minutes: Number(e.target.value),
            }))
          }
          required
        />

        {isEdit ? (
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_active: e.target.checked }))
              }
              className="size-4 accent-primary"
            />
            Active on roster
          </label>
        ) : null}

        {error ? (
          <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add therapist"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
