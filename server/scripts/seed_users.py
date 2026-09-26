"""Seed users + domain demo data for local development / reviewers."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlmodel import Session, select

from app.core.security import hash_password
from app.db.session import engine
from app.models import (
    ActivityLog,
    Appointment,
    AppointmentStatus,
    Invoice,
    InvoiceStatus,
    Package,
    Patient,
    PatientGender,
    PatientStatus,
    PaymentMethod,
    Therapist,
    TherapistDayOverride,
    User,
    UserRole,
)
from app.services.activity import log_activity

SEED_USERS = [
    {
        "email": "admin@physiodesk.com",
        "full_name": "Clinic Admin",
        "password": "Admin123!",
        "role": UserRole.ADMIN,
    },
    {
        "email": "staff@physiodesk.com",
        "full_name": "Front Desk Staff",
        "password": "Staff123!",
        "role": UserRole.STAFF,
    },
]

PACKAGES = [
    {
        "name": "Basic",
        "session_count": 4,
        "price": Decimal("2500.00"),
        "description": "Introductory assessment + follow-ups",
    },
    {
        "name": "Standard",
        "session_count": 8,
        "price": Decimal("4500.00"),
        "description": "Most common rehab package",
    },
    {
        "name": "Premium",
        "session_count": 12,
        "price": Decimal("6500.00"),
        "description": "Extended care with reassessments",
    },
]

THERAPISTS = [
    {
        "full_name": "Dr. Ananya Sharma",
        "specialty": "Sports rehab",
        "working_days": "1,2,3,4,5",
        "default_start_time": time(9, 0),
        "default_end_time": time(17, 0),
        "slot_duration_minutes": 30,
    },
    {
        "full_name": "Rahul Mehta",
        "specialty": "Orthopedic physio",
        "working_days": "1,2,3,4,5",
        "default_start_time": time(10, 0),
        "default_end_time": time(18, 0),
        "slot_duration_minutes": 30,
    },
    {
        "full_name": "Priya Nair",
        "specialty": "Neurological rehab",
        "working_days": "1,2,3,4,6",
        "default_start_time": time(8, 0),
        "default_end_time": time(14, 0),
        "slot_duration_minutes": 30,
    },
    {
        "full_name": "Vikram Joshi",
        "specialty": "Pediatric physio",
        "working_days": "2,3,4,5,6",
        "default_start_time": time(9, 0),
        "default_end_time": time(16, 0),
        "slot_duration_minutes": 30,
    },
    {
        "full_name": "Sneha Karki",
        "specialty": "Geriatric physio",
        "working_days": "1,2,3,4,5,6",
        "default_start_time": time(8, 0),
        "default_end_time": time(14, 0),
        "slot_duration_minutes": 30,
    },
    {
        "full_name": "Amit Poudel",
        "specialty": "Manual therapy",
        "working_days": "1,3,5,6",
        "default_start_time": time(11, 0),
        "default_end_time": time(19, 0),
        "slot_duration_minutes": 45,
    },
    {
        "full_name": "Dr. Kabita Shrestha",
        "specialty": "Women's health physio",
        "working_days": "1,2,3,4,5",
        "default_start_time": time(9, 0),
        "default_end_time": time(16, 0),
        "slot_duration_minutes": 30,
    },
    {
        "full_name": "Hari Bahadur",
        "specialty": "Cardiopulmonary rehab",
        "working_days": "2,4,5,6",
        "default_start_time": time(8, 0),
        "default_end_time": time(13, 0),
        "slot_duration_minutes": 30,
    },
]

PATIENTS = [
    ("Aarav Patel", "9801000001", 34, PatientGender.MALE, "Kathmandu", "ACL sprain", 0, 1, PatientStatus.ACTIVE),
    ("Sita Gurung", "9801000002", 28, PatientGender.FEMALE, "Lalitpur", "Lower back pain", 1, 1, PatientStatus.ACTIVE),
    ("Bikash Thapa", "9801000003", 45, PatientGender.MALE, "Bhaktapur", "Frozen shoulder", 0, 2, PatientStatus.ACTIVE),
    ("Maya Shrestha", "9801000004", 52, PatientGender.FEMALE, "Pokhara", "Knee osteoarthritis", 2, 2, PatientStatus.ON_HOLD),
    ("Kiran Lama", "9801000005", 19, PatientGender.MALE, "Kathmandu", "Ankle sprain", 3, 0, PatientStatus.ACTIVE),
    ("Nisha KC", "9801000006", 37, PatientGender.FEMALE, "Lalitpur", "Cervical spondylosis", 1, 1, PatientStatus.ACTIVE),
    ("Ramesh Adhikari", "9801000007", 61, PatientGender.MALE, "Biratnagar", "Post-stroke gait training", 2, 2, PatientStatus.ACTIVE),
    ("Pooja Magar", "9801000008", 25, PatientGender.FEMALE, "Kathmandu", "IT band syndrome", 0, 0, PatientStatus.COMPLETED),
    ("Sanjay Rai", "9801000009", 41, PatientGender.MALE, "Dharan", "Tennis elbow", 1, 1, PatientStatus.ACTIVE),
    ("Anita Basnet", "9801000010", 33, PatientGender.FEMALE, "Kathmandu", "Postpartum pelvic pain", 3, 1, PatientStatus.ACTIVE),
]


def _get_or_create_users(session: Session) -> dict[str, User]:
    users: dict[str, User] = {}
    for item in SEED_USERS:
        existing = session.exec(select(User).where(User.email == item["email"])).first()
        if existing:
            print(f"skip existing user: {item['email']}")
            users[item["email"]] = existing
            continue
        user = User(
            email=item["email"],
            full_name=item["full_name"],
            hashed_password=hash_password(item["password"]),
            role=item["role"],
            is_active=True,
        )
        session.add(user)
        session.flush()
        print(f"created user: {item['email']} ({item['role'].value})")
        users[item["email"]] = user
    return users


def _seed_packages(session: Session) -> list[Package]:
    if session.exec(select(Package)).first():
        print("skip packages (already seeded)")
        return list(session.exec(select(Package)).all())

    packages: list[Package] = []
    for item in PACKAGES:
        pkg = Package(**item, is_active=True)
        session.add(pkg)
        packages.append(pkg)
    session.flush()
    print(f"created packages: {len(packages)}")
    return packages


def _seed_therapists(session: Session, today: date) -> list[Therapist]:
    """Create any missing therapists from THERAPISTS (safe to re-run).

    Also syncs schedule fields for existing seed therapists so clinic slot length
    stays consistent (30 minutes by default).
    """
    existing = list(session.exec(select(Therapist)).all())
    by_name = {t.full_name: t for t in existing}
    created = 0
    updated = 0

    for item in THERAPISTS:
        current = by_name.get(item["full_name"])
        if current is None:
            t = Therapist(**item, is_active=True)
            session.add(t)
            session.flush()
            by_name[t.full_name] = t
            created += 1
            print(f"created therapist: {t.full_name}")
            continue

        changed = False
        for field in (
            "specialty",
            "working_days",
            "default_start_time",
            "default_end_time",
            "slot_duration_minutes",
        ):
            if getattr(current, field) != item[field]:
                setattr(current, field, item[field])
                changed = True
        if changed:
            session.add(current)
            updated += 1

    therapists = [by_name[item["full_name"]] for item in THERAPISTS if item["full_name"] in by_name]

    # Seed demo overrides only when we first created the base set (no overrides yet)
    has_override = session.exec(select(TherapistDayOverride)).first()
    if not has_override and therapists:
        session.add(
            TherapistDayOverride(
                therapist_id=therapists[0].id,
                override_date=today + timedelta(days=1),
                is_day_off=True,
            )
        )
        if len(therapists) > 1:
            session.add(
                TherapistDayOverride(
                    therapist_id=therapists[1].id,
                    override_date=today,
                    is_day_off=False,
                    start_time=time(11, 0),
                    end_time=time(15, 0),
                )
            )
        print("created day overrides: 2")

    if created == 0 and updated == 0:
        print(f"skip therapists (already have {len(existing)})")
    else:
        print(f"therapists total: {len(by_name)} (+{created} new, ~{updated} updated)")

    return list(session.exec(select(Therapist).order_by(Therapist.full_name)).all())


def _seed_patients(
    session: Session,
    therapists: list[Therapist],
    packages: list[Package],
) -> list[Patient]:
    if session.exec(select(Patient)).first():
        print("skip patients (already seeded)")
        return list(session.exec(select(Patient)).all())

    patients: list[Patient] = []
    for row in PATIENTS:
        name, phone, age, gender, address, condition, t_idx, p_idx, status = row
        patient = Patient(
            full_name=name,
            phone=phone,
            age=age,
            gender=gender,
            address=address,
            condition=condition,
            therapist_id=therapists[t_idx].id,  # type: ignore[index]
            package_id=packages[p_idx].id,  # type: ignore[index]
            status=status,
        )
        session.add(patient)
        patients.append(patient)
    session.flush()
    print(f"created patients: {len(patients)}")
    return patients


def _seed_appointments(
    session: Session,
    patients: list[Patient],
    therapists: list[Therapist],
    today: date,
) -> list[Appointment]:
    if session.exec(select(Appointment)).first():
        print("skip appointments (already seeded)")
        return list(session.exec(select(Appointment)).all())

    specs: list[tuple[int, int, date, time, time, AppointmentStatus, PaymentMethod, str | None]] = [
        (0, 0, today, time(9, 0), time(9, 30), AppointmentStatus.COMPLETED, PaymentMethod.CASH, "Follow-up ACL"),
        (1, 1, today, time(11, 0), time(11, 30), AppointmentStatus.BOOKED, PaymentMethod.UPI, None),
        (2, 0, today, time(10, 0), time(10, 30), AppointmentStatus.BOOKED, PaymentMethod.CARD, None),
        (4, 3, today, time(9, 30), time(10, 0), AppointmentStatus.BOOKED, PaymentMethod.CASH, "Ankle taping"),
        (5, 1, today - timedelta(days=2), time(12, 0), time(12, 30), AppointmentStatus.COMPLETED, PaymentMethod.CASH, None),
        (6, 2, today - timedelta(days=1), time(9, 0), time(9, 45), AppointmentStatus.COMPLETED, PaymentMethod.INSURANCE, "Gait work"),
        (7, 0, today - timedelta(days=10), time(14, 0), time(14, 30), AppointmentStatus.COMPLETED, PaymentMethod.CARD, "Discharge"),
        (8, 1, today + timedelta(days=2), time(13, 0), time(13, 30), AppointmentStatus.BOOKED, PaymentMethod.UPI, None),
        (9, 3, today + timedelta(days=3), time(10, 0), time(10, 30), AppointmentStatus.BOOKED, PaymentMethod.CASH, None),
        (3, 2, today - timedelta(days=5), time(10, 0), time(10, 45), AppointmentStatus.CANCELLED, PaymentMethod.CASH, "Patient cancelled"),
    ]

    appointments: list[Appointment] = []
    for p_idx, t_idx, d, start, end, status, pay, notes in specs:
        appt = Appointment(
            patient_id=patients[p_idx].id,  # type: ignore[index]
            therapist_id=therapists[t_idx].id,  # type: ignore[index]
            appointment_date=d,
            start_time=start,
            end_time=end,
            status=status,
            payment_method=pay,
            notes=notes,
        )
        session.add(appt)
        appointments.append(appt)
    session.flush()
    print(f"created appointments: {len(appointments)}")
    return appointments


def _seed_invoices(
    session: Session,
    *,
    admin: User,
    patients: list[Patient],
    packages: list[Package],
    appointments: list[Appointment],
    today: date,
) -> list[Invoice]:
    if session.exec(select(Invoice)).first():
        print("skip invoices (already seeded)")
        return list(session.exec(select(Invoice)).all())

    now = datetime.now(timezone.utc)
    specs = [
        ("INV-2026-0001", 0, 1, 0, Decimal("4500.00"), Decimal("0.00"), InvoiceStatus.PAID, PaymentMethod.CARD, today, now),
        ("INV-2026-0002", 1, 1, 1, Decimal("4500.00"), Decimal("200.00"), InvoiceStatus.DUE, PaymentMethod.UPI, today, None),
        ("INV-2026-0003", 2, 2, 2, Decimal("6500.00"), Decimal("0.00"), InvoiceStatus.PAID, PaymentMethod.CASH, today, now),
        ("INV-2026-0004", 5, 1, None, Decimal("4500.00"), Decimal("0.00"), InvoiceStatus.DUE, PaymentMethod.CASH, today - timedelta(days=3), None),
        ("INV-2026-0005", 7, 0, 6, Decimal("2500.00"), Decimal("250.00"), InvoiceStatus.PAID, PaymentMethod.CARD, today - timedelta(days=10), now - timedelta(days=10)),
        ("INV-2026-0006", 6, 2, 5, Decimal("6500.00"), Decimal("500.00"), InvoiceStatus.PAID, PaymentMethod.INSURANCE, today - timedelta(days=1), now - timedelta(hours=5)),
    ]

    invoices: list[Invoice] = []
    for number, p_idx, pkg_idx, appt_idx, amount, discount, status, pay, issued, paid_at in specs:
        inv = Invoice(
            invoice_number=number,
            patient_id=patients[p_idx].id,  # type: ignore[index]
            package_id=packages[pkg_idx].id,  # type: ignore[index]
            appointment_id=appointments[appt_idx].id if appt_idx is not None else None,
            created_by_user_id=admin.id,  # type: ignore[arg-type]
            amount=amount,
            discount=discount,
            status=status,
            payment_method=pay,
            issued_on=issued,
            paid_at=paid_at,
        )
        session.add(inv)
        invoices.append(inv)
    session.flush()
    print(f"created invoices: {len(invoices)}")
    return invoices


def seed() -> None:
    today = date.today()
    with Session(engine) as session:
        users = _get_or_create_users(session)
        admin = users["admin@physiodesk.com"]
        staff = users["staff@physiodesk.com"]

        packages = _seed_packages(session)
        therapists = _seed_therapists(session, today)
        patients = _seed_patients(session, therapists, packages)
        appointments = _seed_appointments(session, patients, therapists, today)
        invoices = _seed_invoices(
            session,
            admin=admin,
            patients=patients,
            packages=packages,
            appointments=appointments,
            today=today,
        )

        # Sample activity only when we just created domain data (idempotent via invoice count check above is weak —
        # only add a few logs if none exist)
        if not session.exec(select(ActivityLog)).first() and patients and invoices:
            log_activity(
                session,
                actor=admin,
                action="seed.completed",
                entity_type="system",
                entity_id=None,
                summary="Demo seed data loaded",
            )
            log_activity(
                session,
                actor=staff,
                action="patient.created",
                entity_type="patient",
                entity_id=patients[0].id,
                summary=f"Created patient {patients[0].full_name}",
            )
            log_activity(
                session,
                actor=admin,
                action="invoice.marked_paid",
                entity_type="invoice",
                entity_id=invoices[0].id,
                summary=f"Marked {invoices[0].invoice_number} as paid",
                metadata={"old_status": "due", "new_status": "paid"},
            )
            print("created activity_logs: 3")

        session.commit()
        print("seed complete")


if __name__ == "__main__":
    seed()
