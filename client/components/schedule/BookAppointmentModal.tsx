"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import {
  checkSlotConflict,
  type SlotConflict,
} from "@/lib/schedule-conflict";
import type {
  AppointmentCreatePayload,
  Patient,
  PaymentMethod,
  ScheduleDay,
  Therapist,
} from "@/lib/api";

function toTimeInput(value: string): string {
  return value.slice(0, 5);
}

export function BookAppointmentModal({
  open,
  patients,
  therapists,
  defaultDate,
  defaultTherapistId,
  defaultStartTime,
  scheduleDay,
  onClose,
  onSubmit,
}: {
  open: boolean;
  patients: Patient[];
  therapists: Therapist[];
  defaultDate: string;
  defaultTherapistId?: number | null;
  defaultStartTime?: string | null;
  scheduleDay?: ScheduleDay | null;
  onClose: () => void;
  onSubmit: (payload: AppointmentCreatePayload) => Promise<void>;
}) {
  const [patientId, setPatientId] = useState("");
  const [therapistId, setTherapistId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<SlotConflict | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirmConflict, setConfirmConflict] = useState(false);
  const [pendingPayload, setPendingPayload] =
    useState<AppointmentCreatePayload | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConflict(null);
    setConfirmConflict(false);
    setPendingPayload(null);
    setPatientId(patients[0] ? String(patients[0].id) : "");
    setTherapistId(
      defaultTherapistId
        ? String(defaultTherapistId)
        : therapists[0]
          ? String(therapists[0].id)
          : "",
    );
    setAppointmentDate(defaultDate);
    setStartTime(
      defaultStartTime ? toTimeInput(defaultStartTime) : "09:00",
    );
    setPaymentMethod("cash");
    setNotes("");
  }, [open, patients, therapists, defaultDate, defaultTherapistId, defaultStartTime]);

  useEffect(() => {
    if (!open || !therapistId || !appointmentDate || !startTime) {
      setConflict(null);
      return;
    }

    let active = true;
    const handle = window.setTimeout(() => {
      setChecking(true);
      void checkSlotConflict({
        date: appointmentDate,
        therapistId: Number(therapistId),
        startTime,
        cachedDay: scheduleDay,
      })
        .then((result) => {
          if (active) setConflict(result);
        })
        .catch(() => {
          if (active) setConflict(null);
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [open, therapistId, appointmentDate, startTime, scheduleDay]);

  async function book(payload: AppointmentCreatePayload) {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book appointment");
    } finally {
      setSaving(false);
      setConfirmConflict(false);
      setPendingPayload(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId || !therapistId || !appointmentDate || !startTime) {
      setError("Patient, therapist, date, and time are required.");
      return;
    }
    const payload: AppointmentCreatePayload = {
      patient_id: Number(patientId),
      therapist_id: Number(therapistId),
      appointment_date: appointmentDate,
      start_time: startTime,
      payment_method: paymentMethod,
      notes: notes.trim() || null,
    };

    if (conflict) {
      setPendingPayload(payload);
      setConfirmConflict(true);
      return;
    }

    await book(payload);
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Book appointment"
        description="Select patient, therapist, and an available slot"
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Select
            label="Patient"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            required
          >
            <option value="" disabled>
              Select patient
            </option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} · {p.phone}
              </option>
            ))}
          </Select>
          <Select
            label="Therapist"
            value={therapistId}
            onChange={(e) => setTherapistId(e.target.value)}
            required
          >
            <option value="" disabled>
              Select therapist
            </option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              required
            />
            <Input
              label="Start time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <Select
            label="Payment method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="insurance">Insurance</option>
            <option value="other">Other</option>
          </Select>
          <Input
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {checking ? (
            <p className="text-xs text-text-secondary">Checking availability…</p>
          ) : null}
          {conflict ? (
            <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
              This slot is already booked for {conflict.patientName}. Pick another
              time to avoid a double-booking.
            </p>
          ) : null}
          {error ? (
            <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || checking}>
              {saving ? "Booking…" : "Book"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmConflict}
        title="Slot already booked"
        description={
          conflict
            ? `This time is already booked for ${conflict.patientName}. Booking again will be rejected by the server. Continue anyway?`
            : "This slot appears to be taken."
        }
        confirmLabel="Book anyway"
        cancelLabel="Choose another time"
        tone="danger"
        busy={saving}
        onClose={() => {
          if (!saving) {
            setConfirmConflict(false);
            setPendingPayload(null);
          }
        }}
        onConfirm={() => {
          if (pendingPayload) void book(pendingPayload);
        }}
      />
    </>
  );
}
