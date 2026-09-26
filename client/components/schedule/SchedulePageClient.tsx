"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppointmentDetailModal } from "@/components/schedule/AppointmentDetailModal";
import { BookAppointmentModal } from "@/components/schedule/BookAppointmentModal";
import { MonthView, WeekView, appointmentChipClass } from "@/components/schedule/CalendarViews";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  ApiError,
  apiGet,
  apiPatch,
  apiPost,
  type Appointment,
  type AppointmentCreatePayload,
  type AppointmentStatus,
  type AppointmentUpdatePayload,
  type Paginated,
  type Patient,
  type ScheduleDay,
  type ScheduleSlot,
  type Therapist,
} from "@/lib/api";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  formatDayTitle,
  formatMonthTitle,
  formatWeekTitle,
  fmtTime,
  minutesBetween,
  startOfMonth,
  startOfWeek,
  todayISO,
  weekDays,
} from "@/lib/schedule-dates";
import { cn } from "@/lib/cn";

type CalendarView = "month" | "week" | "day";

function statusLabel(status: AppointmentStatus): string {
  if (status === "no_show") return "No show";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function SchedulePageClient() {
  const [view, setView] = useState<CalendarView>("week");
  const [focusDate, setFocusDate] = useState(todayISO());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dayGrid, setDayGrid] = useState<ScheduleDay | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);

  const [therapistFilter, setTherapistFilter] = useState("");
  const [patientFilter, setPatientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bookOpen, setBookOpen] = useState(false);
  const [bookDate, setBookDate] = useState(todayISO());
  const [bookTherapistId, setBookTherapistId] = useState<number | null>(null);
  const [bookStartTime, setBookStartTime] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const syncing = useRef<"top" | "body" | null>(null);

  const range = useMemo(() => {
    if (view === "month") {
      return { from: startOfWeek(startOfMonth(focusDate)), to: endOfWeek(endOfMonth(focusDate)) };
    }
    if (view === "week") {
      return { from: startOfWeek(focusDate), to: endOfWeek(focusDate) };
    }
    return { from: focusDate, to: focusDate };
  }, [view, focusDate]);

  const title = useMemo(() => {
    if (view === "month") return formatMonthTitle(focusDate);
    if (view === "week") return formatWeekTitle(focusDate);
    return formatDayTitle(focusDate);
  }, [view, focusDate]);

  const loadLookups = useCallback(async () => {
    const [patientPage, therapistPage] = await Promise.all([
      apiGet<Paginated<Patient>>("/api/v1/patients?status=active&page_size=100", true),
      apiGet<Paginated<Therapist>>("/api/v1/therapists?page_size=100", true),
    ]);
    setPatients(patientPage.items);
    setTherapists(therapistPage.items.filter((t) => t.is_active));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("from", range.from);
      params.set("to", range.to);
      if (therapistFilter) params.set("therapist_id", therapistFilter);
      if (patientFilter) params.set("patient_id", patientFilter);
      if (statusFilter) params.set("status", statusFilter);

      const apptsPromise = apiGet<Appointment[]>(
        `/api/v1/appointments?${params.toString()}`,
        true,
      );

      if (view === "day") {
        const dayParams = new URLSearchParams({ date: focusDate });
        if (therapistFilter) dayParams.set("therapist_id", therapistFilter);
        const [appts, schedule] = await Promise.all([
          apptsPromise,
          apiGet<ScheduleDay>(`/api/v1/schedule/day?${dayParams.toString()}`, true),
        ]);
        setAppointments(appts);
        setDayGrid(schedule);
      } else {
        const appts = await apptsPromise;
        setAppointments(appts);
        setDayGrid(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [range, therapistFilter, patientFilter, statusFilter, view, focusDate]);

  useEffect(() => {
    void loadLookups().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load lookups");
    });
  }, [loadLookups]);

  useEffect(() => {
    void load();
  }, [load]);

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
  }, [dayGrid, syncScrollWidths]);

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

  function shift(delta: number) {
    if (view === "month") {
      const [y, m] = focusDate.split("-").map(Number);
      const next = new Date(y, m - 1 + delta, 1);
      setFocusDate(
        `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`,
      );
      return;
    }
    setFocusDate(addDays(focusDate, view === "week" ? delta * 7 : delta));
  }

  function openBook(opts?: {
    date?: string;
    therapistId?: number;
    startTime?: string;
  }) {
    setBookDate(opts?.date ?? focusDate);
    setBookTherapistId(opts?.therapistId ?? (therapistFilter ? Number(therapistFilter) : null));
    setBookStartTime(opts?.startTime ?? null);
    setBookOpen(true);
  }

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

  async function handleStatusChange(status: "completed" | "no_show") {
    if (!selected) return;
    await apiPatch<Appointment>(
      `/api/v1/appointments/${selected.id}`,
      { status },
      true,
    );
    await load();
  }

  async function handleCancel() {
    if (!selected) return;
    await apiPost(`/api/v1/appointments/${selected.id}/cancel`, {}, true);
    await load();
  }

  const therapistOptions = useMemo(() => {
    if (!dayGrid) return therapists;
    return dayGrid.therapists.map((t) => ({
      id: t.id,
      full_name: t.full_name,
      specialty: t.specialty,
      working_days: [] as number[],
      default_start_time: "09:00",
      default_end_time: "17:00",
      slot_duration_minutes: t.slot_duration_minutes,
      is_active: true,
      weekly_hours: 0,
      patients_seen_today: 0,
    })) as Therapist[];
  }, [dayGrid, therapists]);

  const filteredDayAppointments = useMemo(() => {
    if (!patientFilter && !statusFilter) return null;
    return appointments;
  }, [appointments, patientFilter, statusFilter]);

  return (
    <>
      <AppTopBar
        title="Schedule"
        description="Month, week, and day calendar with therapist slot booking"
        actions={
          <Button onClick={() => openBook()}>Book appointment</Button>
        }
      />

      <div className="space-y-4 p-6">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="h-9 w-9 px-0"
                onClick={() => shift(-1)}
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                className="h-9 px-3 text-xs"
                onClick={() => setFocusDate(todayISO())}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                className="h-9 w-9 px-0"
                onClick={() => shift(1)}
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="ml-2 font-display text-xl font-semibold text-text-primary">
                {title}
              </h2>
            </div>

            <div className="inline-flex rounded-[10px] border border-border bg-background p-1">
              {(["month", "week", "day"] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-[8px] px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                    view === v
                      ? "bg-primary text-white"
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label="Therapist"
              value={therapistFilter}
              onChange={(e) => setTherapistFilter(e.target.value)}
            >
              <option value="">All therapists</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </Select>
            <Select
              label="Patient"
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
            >
              <option value="">All patients</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </Select>
            <Select
              label="Booking status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="booked">Booked</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No show</option>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-[6px] bg-status-success-soft px-2 py-0.5 text-status-success ring-1 ring-status-success/25">
                Booked
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-[6px] bg-primary-soft px-2 py-0.5 text-primary-text-on-soft ring-1 ring-primary/30">
                Completed
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-[6px] bg-status-danger-soft px-2 py-0.5 text-status-danger ring-1 ring-status-danger/20">
                Cancelled
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-[6px] bg-status-neutral-soft px-2 py-0.5 text-status-neutral ring-1 ring-status-neutral/20">
                No show
              </span>
            </span>
            {view === "day" ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-sm border border-border bg-surface" />
                  Open slot
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-status-neutral-soft" />
                  Off
                </span>
              </>
            ) : null}
          </div>
        </Card>

        {error ? (
          <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <Card className="overflow-hidden p-0">
          {loading ? (
            <p className="px-5 py-10 text-sm text-text-secondary">Loading calendar…</p>
          ) : view === "month" ? (
            <MonthView
              focusDate={focusDate}
              appointments={appointments}
              onSelectDay={(date) => {
                setFocusDate(date);
                setView("day");
              }}
              onSelectAppointment={setSelected}
            />
          ) : view === "week" ? (
            <WeekView
              days={weekDays(focusDate)}
              appointments={appointments}
              focusDate={focusDate}
              onSelectSlot={(date, hour) =>
                openBook({
                  date,
                  startTime: `${String(hour).padStart(2, "0")}:00`,
                })
              }
              onSelectAppointment={setSelected}
            />
          ) : !dayGrid ? (
            <p className="px-5 py-10 text-sm text-text-secondary">No day grid data.</p>
          ) : dayGrid.therapists.length === 0 ? (
            <p className="px-5 py-10 text-sm text-text-secondary">
              No therapists match the current filters.
            </p>
          ) : (
            <DayGrid
              day={dayGrid}
              patientFilter={patientFilter}
              statusFilter={statusFilter}
              filteredAppointments={filteredDayAppointments}
              topScrollRef={topScrollRef}
              bodyScrollRef={bodyScrollRef}
              tableRef={tableRef}
              scrollWidth={scrollWidth}
              onTopScroll={onTopScroll}
              onBodyScroll={onBodyScroll}
              onBook={(therapistId, startTime) =>
                openBook({ date: focusDate, therapistId, startTime })
              }
              onSelect={setSelected}
            />
          )}
        </Card>
      </div>

      <BookAppointmentModal
        open={bookOpen}
        patients={patients}
        therapists={therapists.length ? therapists : therapistOptions}
        defaultDate={bookDate}
        defaultTherapistId={bookTherapistId}
        defaultStartTime={bookStartTime}
        scheduleDay={dayGrid?.date === bookDate ? dayGrid : null}
        onClose={() => setBookOpen(false)}
        onSubmit={handleBook}
      />

      <AppointmentDetailModal
        open={selected !== null}
        appointment={selected}
        therapists={therapists.length ? therapists : therapistOptions}
        scheduleDay={dayGrid}
        onClose={() => setSelected(null)}
        onReschedule={handleReschedule}
        onCancel={handleCancel}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}

function DayGrid({
  day,
  patientFilter,
  statusFilter,
  filteredAppointments,
  topScrollRef,
  bodyScrollRef,
  tableRef,
  scrollWidth,
  onTopScroll,
  onBodyScroll,
  onBook,
  onSelect,
}: {
  day: ScheduleDay;
  patientFilter: string;
  statusFilter: string;
  filteredAppointments: Appointment[] | null;
  topScrollRef: React.RefObject<HTMLDivElement | null>;
  bodyScrollRef: React.RefObject<HTMLDivElement | null>;
  tableRef: React.RefObject<HTMLTableElement | null>;
  scrollWidth: number;
  onTopScroll: () => void;
  onBodyScroll: () => void;
  onBook: (therapistId: number, startTime: string) => void;
  onSelect: (appt: Appointment) => void;
}) {
  const GRID_STEP = 15;

  type CellPlan =
    | { kind: "skip" }
    | { kind: "off" }
    | { kind: "block"; rowspan: number; slot: ScheduleSlot };

  const columnPlans = useMemo(() => {
    const labels = day.time_labels;
    const plans: Record<number, CellPlan[]> = {};
    const allowedIds =
      filteredAppointments != null
        ? new Set(filteredAppointments.map((a) => a.id))
        : null;

    for (const therapist of day.therapists) {
      const plan: CellPlan[] = labels.map(() => ({ kind: "off" }));

      if (therapist.is_day_off) {
        plans[therapist.id] = plan;
        continue;
      }

      for (const slot of therapist.slots) {
        if (slot.state !== "open" && slot.state !== "booked") continue;
        if (
          slot.state === "booked" &&
          slot.appointment &&
          allowedIds &&
          (patientFilter || statusFilter) &&
          !allowedIds.has(slot.appointment.id)
        ) {
          continue;
        }

        const startKey = fmtTime(slot.start_time);
        const startIdx = labels.findIndex((l) => fmtTime(l) === startKey);
        if (startIdx < 0) continue;

        const duration = Math.max(
          GRID_STEP,
          minutesBetween(slot.start_time, slot.end_time) ||
            therapist.slot_duration_minutes,
        );
        const rowspan = Math.max(1, Math.round(duration / GRID_STEP));
        plan[startIdx] = { kind: "block", rowspan, slot };
        for (let i = 1; i < rowspan && startIdx + i < plan.length; i++) {
          plan[startIdx + i] = { kind: "skip" };
        }
      }

      plans[therapist.id] = plan;
    }

    return plans;
  }, [day, filteredAppointments, patientFilter, statusFilter]);

  return (
    <div className="flex flex-col">
      <div
        ref={topScrollRef}
        onScroll={onTopScroll}
        className="schedule-top-scroll overflow-x-auto overflow-y-hidden border-b border-border bg-background/60"
        aria-label="Schedule horizontal scroll"
      >
        <div style={{ width: scrollWidth || undefined, height: 1 }} />
      </div>
      <div
        ref={bodyScrollRef}
        onScroll={onBodyScroll}
        className="schedule-body-scroll max-h-[70vh] overflow-auto"
      >
        <table ref={tableRef} className="w-full min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr>
              <th className="sticky left-0 z-20 w-20 border-b border-r border-border bg-surface px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                Time
              </th>
              {day.therapists.map((t) => (
                <th
                  key={t.id}
                  className="min-w-[160px] border-b border-r border-border px-3 py-3 text-left"
                >
                  <div className="font-medium text-text-primary">{t.full_name}</div>
                  <div className="text-xs font-normal text-text-secondary">
                    {t.specialty} · {t.slot_duration_minutes}m
                    {t.is_day_off ? " · Off" : ""}
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
                  No working hours for this day.
                </td>
              </tr>
            ) : (
              day.time_labels.map((label, rowIndex) => (
                <tr key={label} className="schedule-grid-row h-7">
                  <td className="sticky left-0 z-[5] border-b border-dashed border-border bg-surface px-3 py-0 font-mono text-[11px] leading-7 text-text-secondary">
                    {fmtTime(label)}
                  </td>
                  {day.therapists.map((t) => {
                    const cell = columnPlans[t.id]?.[rowIndex] ?? { kind: "off" as const };
                    if (cell.kind === "skip") return null;

                    if (cell.kind === "off" || t.is_day_off) {
                      return (
                        <td
                          key={t.id}
                          className="border-b border-dashed border-r border-border bg-status-neutral-soft/15"
                        />
                      );
                    }

                    const { slot, rowspan } = cell;
                    if (slot.state === "booked" && slot.appointment) {
                      const appt = slot.appointment;
                      return (
                        <td
                          key={t.id}
                          rowSpan={rowspan}
                          className="border-b border-dashed border-r border-border p-1 align-top"
                        >
                          <button
                            type="button"
                            onClick={() => onSelect(appt)}
                            className={cn(
                              "flex h-full min-h-full w-full flex-col rounded-[10px] px-2 py-1.5 text-left transition-opacity hover:opacity-90",
                              appointmentChipClass(appt.status),
                            )}
                            style={{ minHeight: `${rowspan * 1.75}rem` }}
                          >
                            <div className="font-mono text-[10px] opacity-90">
                              {fmtTime(appt.start_time)}–{fmtTime(appt.end_time)}
                            </div>
                            <div className="mt-0.5 truncate text-xs font-medium">
                              {appt.patient_name}
                            </div>
                            <div className="mt-auto pt-1">
                              <StatusPill
                                tone={
                                  appt.status === "cancelled"
                                    ? "danger"
                                    : appt.status === "no_show"
                                      ? "neutral"
                                      : appt.status === "completed"
                                        ? "neutral"
                                        : "success"
                                }
                              >
                                {statusLabel(appt.status as AppointmentStatus)}
                              </StatusPill>
                            </div>
                          </button>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={t.id}
                        rowSpan={rowspan}
                        className="border-b border-dashed border-r border-border p-1 align-top"
                      >
                        <button
                          type="button"
                          onClick={() => onBook(t.id, fmtTime(slot.start_time))}
                          className="flex w-full items-start rounded-[10px] border border-dashed border-border px-2 py-1.5 text-left text-xs text-text-secondary transition-colors hover:border-primary hover:bg-primary-soft/50 hover:text-primary-text-on-soft"
                          style={{ minHeight: `${rowspan * 1.75}rem` }}
                        >
                          <span>
                            Open
                            <span className="mt-0.5 block font-mono text-[10px] opacity-70">
                              {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}
                            </span>
                          </span>
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
  );
}
