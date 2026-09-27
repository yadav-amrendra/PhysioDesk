"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  checkSlotConflict,
  type SlotConflict,
} from "@/lib/schedule-conflict";
import type {
  Appointment,
  AppointmentUpdatePayload,
  PaymentMethod,
  ScheduleDay,
  Therapist,
} from "@/lib/api";

function toTimeInput(value: string): string {
  return value.slice(0, 5);
}

function statusTone(status: string): "success" | "neutral" | "danger" {
  if (status === "booked") return "success";
  if (status === "completed") return "neutral";
  if (status === "cancelled" || status === "no_show") return "danger";
  return "neutral";
}

function statusLabel(status: string): string {
  if (status === "no_show") return "No show";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function AppointmentDetailModal({
  open,
  appointment,
  therapists,
  scheduleDay,
  onClose,
  onReschedule,
  onCancel,
  onStatusChange,
}: {
  open: boolean;
  appointment: Appointment | null;
  therapists: Therapist[];
  scheduleDay?: ScheduleDay | null;
  onClose: () => void;
  onReschedule: (payload: AppointmentUpdatePayload) => Promise<void>;
  onCancel: () => Promise<void>;
  onStatusChange: (status: "completed" | "no_show") => Promise<void>;
}) {
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [therapistId, setTherapistId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<"completed" | "no_show" | null>(
    null,
  );
  const [conflict, setConflict] = useState<SlotConflict | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirmConflict, setConfirmConflict] = useState(false);
  const [pendingPayload, setPendingPayload] =
    useState<AppointmentUpdatePayload | null>(null);

  useEffect(() => {
    if (!open || !appointment) return;
    setMode("view");
    setError(null);
    setConfirmCancel(false);
    setConfirmStatus(null);
    setConfirmConflict(false);
    setPendingPayload(null);
    setConflict(null);
    setTherapistId(String(appointment.therapist_id));
    setAppointmentDate(appointment.appointment_date);
    setStartTime(toTimeInput(appointment.start_time));
    setPaymentMethod(appointment.payment_method);
    setNotes(appointment.notes ?? "");
  }, [open, appointment]);

  useEffect(() => {
    if (!open || mode !== "reschedule" || !appointment || !therapistId || !appointmentDate || !startTime) {
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
        excludeAppointmentId: appointment.id,
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
  }, [open, mode, appointment, therapistId, appointmentDate, startTime, scheduleDay]);

  async function save(payload: AppointmentUpdatePayload) {
    setSaving(true);
    setError(null);
    try {
      await onReschedule(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reschedule");
    } finally {
      setSaving(false);
      setConfirmConflict(false);
      setPendingPayload(null);
    }
  }

  async function handleReschedule(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment) return;
    const payload: AppointmentUpdatePayload = {
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

    await save(payload);
  }

  async function handleCancelConfirm() {
    setCancelBusy(true);
    try {
      await onCancel();
      setConfirmCancel(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
      setConfirmCancel(false);
    } finally {
      setCancelBusy(false);
    }
  }

  async function handleStatusConfirm() {
    if (!confirmStatus) return;
    setStatusBusy(true);
    setError(null);
    try {
      await onStatusChange(confirmStatus);
      setConfirmStatus(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
      setConfirmStatus(null);
    } finally {
      setStatusBusy(false);
    }
  }

  if (!appointment) return null;

  const canUpdateOutcome = appointment.status === "booked";

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Appointment"
        description={`${appointment.patient_name} · ${appointment.therapist_name}`}
        className="max-w-lg"
      >
        {mode === "view" ? (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-secondary">
                  Date
                </dt>
                <dd className="mt-1 font-mono">{appointment.appointment_date}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-secondary">
                  Time
                </dt>
                <dd className="mt-1 font-mono">
                  {toTimeInput(appointment.start_time)}–
                  {toTimeInput(appointment.end_time)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-secondary">
                  Status
                </dt>
                <dd className="mt-1">
                  <StatusPill tone={statusTone(appointment.status)}>
                    {statusLabel(appointment.status)}
                  </StatusPill>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-secondary">
                  Payment
                </dt>
                <dd className="mt-1 capitalize">{appointment.payment_method}</dd>
              </div>
              {appointment.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-text-secondary">
                    Notes
                  </dt>
                  <dd className="mt-1 text-text-secondary">{appointment.notes}</dd>
                </div>
              ) : null}
            </dl>

            {error ? (
              <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
                {error}
              </p>
            ) : null}

            {appointment.status !== "cancelled" ? (
              <div className="flex flex-col gap-2">
                {canUpdateOutcome ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={statusBusy}
                      onClick={() => setConfirmStatus("completed")}
                    >
                      Mark completed
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={statusBusy}
                      onClick={() => setConfirmStatus("no_show")}
                    >
                      Mark no show
                    </Button>
                  </div>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  {canUpdateOutcome ? (
                    <>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => setConfirmCancel(true)}
                      >
                        Cancel appointment
                      </Button>
                      <Button type="button" onClick={() => setMode("reschedule")}>
                        Reschedule
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <form onSubmit={handleReschedule} className="flex flex-col gap-4">
            <Select
              label="Therapist"
              value={therapistId}
              onChange={(e) => setTherapistId(e.target.value)}
              required
            >
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
              <option value="insurance">Insurance</option>
              <option value="other">Other</option>
            </Select>
            <Input
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {checking ? (
              <p className="text-xs text-text-secondary">Checking availability…</p>
            ) : null}
            {conflict ? (
              <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
                That slot is already booked for {conflict.patientName}. Pick another
                time to avoid a double-booking.
              </p>
            ) : null}
            {error ? (
              <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode("view")}
                disabled={saving}
              >
                Back
              </Button>
              <Button type="submit" disabled={saving || checking}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel appointment?"
        description={
          appointment
            ? `Cancel ${appointment.patient_name}'s slot on ${appointment.appointment_date} at ${toTimeInput(appointment.start_time)}? The slot will become available again.`
            : ""
        }
        confirmLabel="Cancel appointment"
        busy={cancelBusy}
        onClose={() => {
          if (!cancelBusy) setConfirmCancel(false);
        }}
        onConfirm={handleCancelConfirm}
      />

      <ConfirmDialog
        open={confirmStatus !== null}
        title={
          confirmStatus === "completed"
            ? "Mark as completed?"
            : "Mark as no show?"
        }
        description={
          appointment && confirmStatus === "completed"
            ? `Confirm that ${appointment.patient_name} attended this session.`
            : appointment
              ? `Record that ${appointment.patient_name} did not attend this appointment.`
              : ""
        }
        confirmLabel={
          confirmStatus === "completed" ? "Mark completed" : "Mark no show"
        }
        tone={confirmStatus === "no_show" ? "danger" : "primary"}
        busy={statusBusy}
        onClose={() => {
          if (!statusBusy) setConfirmStatus(null);
        }}
        onConfirm={handleStatusConfirm}
      />

      <ConfirmDialog
        open={confirmConflict}
        title="Slot already booked"
        description={
          conflict
            ? `This time is already booked for ${conflict.patientName}. Saving anyway will be rejected by the server. Continue?`
            : "This slot appears to be taken."
        }
        confirmLabel="Save anyway"
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
          if (pendingPayload) void save(pendingPayload);
        }}
      />
    </>
  );
}
