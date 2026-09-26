"use client";

import type { Appointment, AppointmentStatus } from "@/lib/api";
import {
  dayNumber,
  fmtTime,
  monthGridDays,
  sameMonth,
  todayISO,
  weekdayShort,
} from "@/lib/schedule-dates";
import { cn } from "@/lib/cn";

export function appointmentChipClass(status: AppointmentStatus | string): string {
  switch (status) {
    case "booked":
      return "bg-status-success-soft text-status-success ring-1 ring-status-success/25";
    case "completed":
      return "bg-primary-soft text-primary-text-on-soft ring-1 ring-primary/30";
    case "cancelled":
      return "bg-status-danger-soft text-status-danger ring-1 ring-status-danger/20";
    case "no_show":
      return "bg-status-neutral-soft text-status-neutral ring-1 ring-status-neutral/20";
    default:
      return "bg-primary-soft text-primary-text-on-soft ring-1 ring-primary/15";
  }
}

function timeRange(a: Appointment): string {
  return `${fmtTime(a.start_time)}–${fmtTime(a.end_time)}`;
}

function AppointmentChip({
  appointment,
  dense = false,
  onSelect,
}: {
  appointment: Appointment;
  dense?: boolean;
  onSelect: (appt: Appointment) => void;
}) {
  return (
    <span
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(appointment);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          onSelect(appointment);
        }
      }}
      className={cn(
        "block rounded-[8px] px-1.5 py-1 text-left transition-opacity hover:opacity-90",
        appointmentChipClass(appointment.status),
        dense ? "text-[10px] leading-tight" : "text-[11px]",
      )}
    >
      <span className="font-mono opacity-90">{timeRange(appointment)}</span>
      <span className={cn("block truncate font-medium", dense ? "mt-0.5" : "mt-0.5")}>
        {appointment.patient_name}
      </span>
      <span className="block truncate opacity-80">
        {appointment.therapist_name}
      </span>
    </span>
  );
}

export function MonthView({
  focusDate,
  appointments,
  onSelectDay,
  onSelectAppointment,
}: {
  focusDate: string;
  appointments: Appointment[];
  onSelectDay: (date: string) => void;
  onSelectAppointment: (appt: Appointment) => void;
}) {
  const days = monthGridDays(focusDate);
  const today = todayISO();
  const byDate = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const list = byDate.get(a.appointment_date) ?? [];
    list.push(a);
    byDate.set(a.appointment_date, list);
  }

  const weekHeaders = days.slice(0, 7).map((d) => weekdayShort(d));

  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-background/80">
        {weekHeaders.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-text-secondary"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[minmax(130px,1fr)]">
        {days.map((iso) => {
          const inMonth = sameMonth(iso, focusDate);
          const items = byDate.get(iso) ?? [];
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              className={cn(
                "flex min-h-[130px] flex-col gap-1 border-b border-r border-border p-2 text-left transition-colors hover:bg-primary-soft/40",
                !inMonth && "bg-background/50 text-text-secondary",
                isToday && "bg-primary-soft/30",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs",
                  isToday && "bg-primary text-white",
                )}
              >
                {dayNumber(iso)}
              </span>
              <div className="flex flex-col gap-1 overflow-hidden">
                {items.slice(0, 3).map((a) => (
                  <AppointmentChip
                    key={a.id}
                    appointment={a}
                    dense
                    onSelect={onSelectAppointment}
                  />
                ))}
                {items.length > 3 ? (
                  <span className="text-[11px] text-text-secondary">
                    +{items.length - 3} more
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WeekView({
  days,
  appointments,
  focusDate,
  onSelectSlot,
  onSelectAppointment,
}: {
  days: string[];
  appointments: Appointment[];
  focusDate: string;
  onSelectSlot: (date: string, hour: number) => void;
  onSelectAppointment: (appt: Appointment) => void;
}) {
  const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 08–18
  const today = todayISO();
  const byDate = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const list = byDate.get(a.appointment_date) ?? [];
    list.push(a);
    byDate.set(a.appointment_date, list);
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-border bg-background/80">
          <div />
          {days.map((iso) => {
            const isToday = iso === today;
            const isFocused = iso === focusDate;
            return (
              <div
                key={iso}
                className={cn(
                  "px-2 py-2 text-center",
                  (isToday || isFocused) && "bg-primary-soft/40",
                )}
              >
                <p className="text-xs uppercase text-text-secondary">
                  {weekdayShort(iso)}
                </p>
                <p
                  className={cn(
                    "mx-auto mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm font-medium",
                    isToday && "bg-primary text-white",
                    !isToday && isFocused && "bg-primary/15 text-primary-text-on-soft",
                  )}
                >
                  {dayNumber(iso)}
                </p>
              </div>
            );
          })}
        </div>
        {hours.map((hour) => {
          const label = `${String(hour).padStart(2, "0")}:00`;
          return (
            <div
              key={hour}
              className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-border"
            >
              <div className="px-2 py-3 font-mono text-[11px] text-text-secondary">
                {label}
              </div>
              {days.map((iso) => {
                const isToday = iso === today;
                const isFocused = iso === focusDate;
                const slotAppts = (byDate.get(iso) ?? []).filter(
                  (a) => Number(fmtTime(a.start_time).slice(0, 2)) === hour,
                );
                return (
                  <button
                    key={`${iso}-${hour}`}
                    type="button"
                    onClick={() => onSelectSlot(iso, hour)}
                    className={cn(
                      "min-h-[72px] border-l border-border p-1 text-left hover:bg-primary-soft/40",
                      (isToday || isFocused) && "bg-primary-soft/20",
                    )}
                  >
                    <div className="flex flex-col gap-1">
                      {slotAppts.map((a) => (
                        <AppointmentChip
                          key={a.id}
                          appointment={a}
                          onSelect={onSelectAppointment}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
