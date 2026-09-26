from __future__ import annotations

from datetime import date, timezone
from decimal import Decimal

from sqlmodel import Session, col, func, select

from app.models.appointment import Appointment
from app.models.enums import AppointmentStatus, InvoiceStatus
from app.models.invoice import Invoice
from app.models.package import Package
from app.models.patient import Patient
from app.models.therapist import Therapist
from app.schemas.dashboard import (
    DashboardResponse,
    DashboardStats,
    RecentPatientItem,
    TherapistCapacityItem,
)
from app.services.activity import recent_activity_logs
from app.services.schedule import (
    generate_slot_starts,
    get_day_schedule,
    resolve_day_window,
)


def get_dashboard(session: Session, on_date: date | None = None) -> DashboardResponse:
    day = on_date or date.today()

    patients_seen = int(
        session.exec(
            select(func.count())
            .select_from(Appointment)
            .where(Appointment.appointment_date == day)
            .where(
                col(Appointment.status).in_(
                    [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED]
                )
            )
        ).one()
    )

    # Revenue: invoices marked paid whose paid_at falls on this calendar day (UTC date)
    paid_invoices = session.exec(
        select(Invoice).where(Invoice.status == InvoiceStatus.PAID)
    ).all()
    revenue = Decimal("0.00")
    for inv in paid_invoices:
        if inv.paid_at is None:
            continue
        paid_day = (
            inv.paid_at.astimezone(timezone.utc).date()
            if inv.paid_at.tzinfo is not None
            else inv.paid_at.date()
        )
        if paid_day == day:
            revenue += inv.amount - inv.discount
    revenue = revenue.quantize(Decimal("0.01"))

    schedule = get_day_schedule(session, day)
    capacity: list[TherapistCapacityItem] = []
    open_slots_total = 0
    on_duty = 0

    for col_t in schedule.therapists:
        if col_t.is_day_off:
            continue
        on_duty += 1
        booked = sum(1 for s in col_t.slots if s.state == "booked")
        open_count = sum(1 for s in col_t.slots if s.state == "open")
        total = booked + open_count
        open_slots_total += open_count
        ratio = (booked / total) if total > 0 else 0.0
        capacity.append(
            TherapistCapacityItem(
                therapist_id=col_t.id,
                therapist_name=col_t.full_name,
                specialty=col_t.specialty,
                total_slots=total,
                booked_slots=booked,
                open_slots=open_count,
                booked_ratio=round(ratio, 3),
            )
        )

    # Fallback capacity count if schedule columns missed somehow
    if not capacity:
        therapists = session.exec(
            select(Therapist).where(Therapist.is_active == True)  # noqa: E712
        ).all()
        for t in therapists:
            assert t.id is not None
            is_off, start, end = resolve_day_window(session, t, day)
            if is_off or start is None or end is None:
                continue
            on_duty += 1
            slots = generate_slot_starts(start, end, t.slot_duration_minutes)
            booked_count = int(
                session.exec(
                    select(func.count())
                    .select_from(Appointment)
                    .where(Appointment.therapist_id == t.id)
                    .where(Appointment.appointment_date == day)
                    .where(
                        col(Appointment.status).in_(
                            [
                                AppointmentStatus.BOOKED,
                                AppointmentStatus.COMPLETED,
                                AppointmentStatus.NO_SHOW,
                            ]
                        )
                    )
                ).one()
            )
            total = len(slots)
            open_count = max(total - booked_count, 0)
            open_slots_total += open_count
            capacity.append(
                TherapistCapacityItem(
                    therapist_id=t.id,
                    therapist_name=t.full_name,
                    specialty=t.specialty,
                    total_slots=total,
                    booked_slots=min(booked_count, total),
                    open_slots=open_count,
                    booked_ratio=round((min(booked_count, total) / total) if total else 0.0, 3),
                )
            )

    recent_rows = session.exec(
        select(Patient).order_by(col(Patient.created_at).desc()).limit(8)
    ).all()
    therapist_ids = {p.therapist_id for p in recent_rows}
    package_ids = {p.package_id for p in recent_rows}
    therapists = {
        t.id: t.full_name
        for t in session.exec(select(Therapist).where(col(Therapist.id).in_(therapist_ids))).all()
        if t.id is not None
    } if therapist_ids else {}
    packages = {
        pkg.id: pkg.name
        for pkg in session.exec(select(Package).where(col(Package.id).in_(package_ids))).all()
        if pkg.id is not None
    } if package_ids else {}

    recent_patients = [
        RecentPatientItem(
            id=p.id,  # type: ignore[arg-type]
            full_name=p.full_name,
            condition=p.condition,
            therapist_name=therapists.get(p.therapist_id, "—"),
            package_name=packages.get(p.package_id, "—"),
            status=p.status,
        )
        for p in recent_rows
    ]

    return DashboardResponse(
        date=day,
        stats=DashboardStats(
            patients_seen_today=patients_seen,
            therapists_on_duty=on_duty,
            revenue_today=revenue,
            open_slots_today=open_slots_total,
        ),
        capacity=capacity,
        recent_patients=recent_patients,
        recent_activity=recent_activity_logs(session, limit=8),
    )
