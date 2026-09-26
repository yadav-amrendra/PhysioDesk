"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppointmentDetailModal } from "@/components/schedule/AppointmentDetailModal";
import { BookAppointmentModal } from "@/components/schedule/BookAppointmentModal";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  ApiError,
  apiGet,
  apiPatch,
  apiPost,
  type Appointment,
  type AppointmentCreatePayload,
  type AppointmentUpdatePayload,
  type Paginated,
  type Patient,
  type ScheduleDay,
  type ScheduleSlot,
  type Therapist,
} from "@/lib/api";
import { cn } from "@/lib/cn";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(value: string): string {
  return value.slice(0, 5);
}

function findSlot(
  columnSlots: ScheduleSlot[],
  label: string,
): ScheduleSlot | null {
  const key = fmtTime(label);
  return (
    columnSlots.find((s) => fmtTime(s.start_time) === key) ?? null
  );
}

export function SchedulePageClient() {
  const [date, setDate] = useState(todayISO);
  const [day, setDay] = useState<ScheduleDay | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bookOpen, setBookOpen] = useState(false);
  const [bookTherapistId, setBookTherapistId] = useState<number | null>(null);
  const [bookStartTime, setBookStartTime] = useState<string | null>(null);

  const [selected, setSelected] = useState<Appointment | null>(null);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const syncing = useRef<"top" | "body" | null>(null);

  const syncScrollWidths = useCallback(() => {
    const table = tableRef.current;
    if (!table) return;
    setScrollWidth(table.scrollWidth);
  }, []);

  useEffect(() => {
    syncScrollWidths();
    const table = tableRef.current;
    if (!table || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => syncScrollWidths());
    ro.observe(table);
    return () => ro.disconnect();
  }, [day, syncScrollWidths]);

  function onTopScroll() {
    if (syncing.current === "body") return;
    const top = topScrollRef.current;
    const body = bodyScrollRef.current;
    if (!top || !body) return;
    syncing.current = "top";
    body.scrollLeft = top.scrollLeft;
    syncing.current = null;
  }

  function onBodyScroll() {
    if (syncing.current === "top") return;
    const top = topScrollRef.current;
    const body = bodyScrollRef.current;
    if (!top || !body) return;
    syncing.current = "body";
    top.scrollLeft = body.scrollLeft;
    syncing.current = null;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schedule, patientPage, therapistPage] = await Promise.all([
        apiGet<ScheduleDay>(`/api/v1/schedule/day?date=${date}`, true),
        apiGet<Paginated<Patient>>("/api/v1/patients?status=active&page_size=100", true),
        apiGet<Paginated<Therapist>>("/api/v1/therapists?page_size=100", true),
      ]);
      setDay(schedule);
      setPatients(patientPage.items);
      setTherapists(therapistPage.items.filter((t) => t.is_active));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const therapistOptions = useMemo(
    () =>
      (day?.therapists ?? []).map((t) => ({
        id: t.id,
        full_name: t.full_name,
        specialty: t.specialty,
        working_days: [],
        default_start_time: "09:00",
        default_end_time: "17:00",
        slot_duration_minutes: t.slot_duration_minutes,
        is_active: true,
        weekly_hours: 0,
        patients_seen_today: 0,
      })) as Therapist[],
    [day],
  );

  async function handleBook(payload: AppointmentCreatePayload) {
    await apiPost<Appointment>("/api/v1/appointments", payload, true);
    await load();
  }

  async function handleReschedule(payload: AppointmentUpdatePayload) {
    if (!selected) return;
    await apiPatch<Appointment>(
      `/api/v1/appointments/${selected.id}`,
      payload,
      true,
    );
    await load();
  }

  async function handleCancel() {
    if (!selected) return;
    await apiPost(`/api/v1/appointments/${selected.id}/cancel`, {}, true);
    await load();
  }

  function openBook(therapistId?: number, startTime?: string) {
    setBookTherapistId(therapistId ?? null);
    setBookStartTime(startTime ?? null);
    setBookOpen(true);
  }

  return (
    <>
      <AppTopBar
        title="Schedule"
        description="Therapist columns and time-slot rows for the selected date"
        actions={
          <Button onClick={() => openBook()}>Book appointment</Button>
        }
      />

      <div className="space-y-4 p-6">
        <Card className="flex flex-wrap items-end gap-4">
          <div className="w-full max-w-xs">
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-text-secondary pb-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm border border-border bg-surface" />
              Open
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-primary-soft" />
              Booked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-status-neutral-soft" />
              Off
            </span>
          </div>
        </Card>

        {error ? (
          <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <Card className="overflow-hidden p-0">
          {loading || !day ? (
            <p className="px-5 py-8 text-sm text-text-secondary">
              {loading ? "Loading schedule…" : "No schedule data."}
            </p>
          ) : day.therapists.length === 0 ? (
            <p className="px-5 py-8 text-sm text-text-secondary">
              No active therapists on the roster.
            </p>
          ) : (
            <div className="flex flex-col">
              {/* Top horizontal scrollbar — easier when many therapist columns */}
              <div
                ref={topScrollRef}
                onScroll={onTopScroll}
                className="schedule-top-scroll overflow-x-auto overflow-y-hidden border-b border-border bg-background/60"
                aria-label="Schedule horizontal scroll"
              >
                <div
                  className="h-2.5"
                  style={{ width: scrollWidth > 0 ? scrollWidth : "100%" }}
                />
              </div>

              <div
                ref={bodyScrollRef}
                onScroll={onBodyScroll}
                className="schedule-body-scroll max-h-[calc(100vh-18rem)] overflow-auto"
              >
                <table
                  ref={tableRef}
                  className="w-max min-w-full border-collapse text-sm"
                >
                <thead>
                  <tr className="border-b border-border bg-background/80">
                    <th className="sticky left-0 top-0 z-20 bg-background px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                      Time
                    </th>
                    {day.therapists.map((t) => (
                      <th
                        key={t.id}
                        className="sticky top-0 z-10 min-w-[160px] bg-background px-3 py-3 text-left font-medium text-text-primary"
                      >
                        <div className="font-display text-base">{t.full_name}</div>
                        <div className="text-xs font-normal text-text-secondary">
                          {t.is_day_off
                            ? "Off"
                            : `${fmtTime(t.start_time ?? "")}–${fmtTime(t.end_time ?? "")} · ${t.slot_duration_minutes}m`}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {day.time_labels.length === 0 ? (
                    <tr>
                      <td
                        colSpan={day.therapists.length + 1}
                        className="px-4 py-8 text-text-secondary"
                      >
                        No slots for this date (all therapists off).
                      </td>
                    </tr>
                  ) : (
                    day.time_labels.map((label) => (
                      <tr key={label} className="border-b border-border last:border-0">
                        <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-mono text-xs text-text-secondary">
                          {fmtTime(label)}
                        </td>
                        {day.therapists.map((t) => {
                          if (t.is_day_off) {
                            const booked = findSlot(t.slots, label);
                            if (booked?.state === "booked" && booked.appointment) {
                              return (
                                <td key={t.id} className="px-2 py-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelected(booked.appointment)}
                                    className="w-full rounded-[10px] bg-primary-soft px-2 py-2 text-left text-xs text-primary-text-on-soft hover:brightness-95"
                                  >
                                    <div className="font-medium truncate">
                                      {booked.appointment.patient_name}
                                    </div>
                                    <div className="opacity-80">Booked · off day</div>
                                  </button>
                                </td>
                              );
                            }
                            return (
                              <td key={t.id} className="px-2 py-1.5">
                                <div className="rounded-[10px] bg-status-neutral-soft px-2 py-2 text-center text-xs text-status-neutral">
                                  Off
                                </div>
                              </td>
                            );
                          }

                          const slot = findSlot(t.slots, label);
                          if (!slot) {
                            return (
                              <td key={t.id} className="px-2 py-1.5">
                                <div className="rounded-[10px] bg-status-neutral-soft/50 px-2 py-2 text-center text-xs text-text-secondary">
                                  —
                                </div>
                              </td>
                            );
                          }

                          if (slot.state === "booked" && slot.appointment) {
                            return (
                              <td key={t.id} className="px-2 py-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelected(slot.appointment)}
                                  className="w-full rounded-[10px] bg-primary-soft px-2 py-2 text-left text-xs text-primary-text-on-soft hover:brightness-95"
                                >
                                  <div className="font-medium truncate">
                                    {slot.appointment.patient_name}
                                  </div>
                                  <div className="font-mono opacity-80">
                                    {fmtTime(slot.start_time)}–
                                    {fmtTime(slot.end_time)}
                                  </div>
                                </button>
                              </td>
                            );
                          }

                          return (
                            <td key={t.id} className="px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => openBook(t.id, slot.start_time)}
                                className={cn(
                                  "w-full rounded-[10px] border border-dashed border-border bg-surface px-2 py-2 text-center text-xs text-text-secondary transition-colors hover:border-primary hover:bg-primary-soft/40 hover:text-primary-text-on-soft",
                                )}
                              >
                                Open
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>

      <BookAppointmentModal
        open={bookOpen}
        patients={patients}
        therapists={therapists.length ? therapists : therapistOptions}
        defaultDate={date}
        defaultTherapistId={bookTherapistId}
        defaultStartTime={bookStartTime}
        scheduleDay={day}
        onClose={() => setBookOpen(false)}
        onSubmit={handleBook}
      />

      <AppointmentDetailModal
        open={selected !== null}
        appointment={selected}
        therapists={therapists.length ? therapists : therapistOptions}
        scheduleDay={day}
        onClose={() => setSelected(null)}
        onReschedule={handleReschedule}
        onCancel={handleCancel}
      />
    </>
  );
}
