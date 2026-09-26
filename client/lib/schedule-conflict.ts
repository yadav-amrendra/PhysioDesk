import { apiGet, type ScheduleDay } from "@/lib/api";

export type SlotConflict = {
  patientName: string;
  appointmentId: number;
};

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

export function findSlotConflict(
  day: ScheduleDay,
  therapistId: number,
  startTime: string,
  excludeAppointmentId?: number | null,
): SlotConflict | null {
  const column = day.therapists.find((t) => t.id === therapistId);
  if (!column) return null;
  const target = normalizeTime(startTime);
  for (const slot of column.slots) {
    if (slot.state !== "booked" || !slot.appointment) continue;
    if (normalizeTime(slot.start_time) !== target) continue;
    if (
      excludeAppointmentId != null &&
      slot.appointment.id === excludeAppointmentId
    ) {
      continue;
    }
    return {
      patientName: slot.appointment.patient_name,
      appointmentId: slot.appointment.id,
    };
  }
  return null;
}

/** Load the day grid and check for a booked slot conflict. */
export async function checkSlotConflict(options: {
  date: string;
  therapistId: number;
  startTime: string;
  excludeAppointmentId?: number | null;
  cachedDay?: ScheduleDay | null;
}): Promise<SlotConflict | null> {
  const {
    date,
    therapistId,
    startTime,
    excludeAppointmentId,
    cachedDay,
  } = options;

  let day = cachedDay && cachedDay.date === date ? cachedDay : null;
  if (!day) {
    day = await apiGet<ScheduleDay>(`/api/v1/schedule/day?date=${date}`, true);
  }
  return findSlotConflict(day, therapistId, startTime, excludeAppointmentId);
}
