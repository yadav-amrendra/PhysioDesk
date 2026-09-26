from __future__ import annotations

from decimal import Decimal

from fastapi import HTTPException, status
from sqlmodel import Session, col, or_, select

from app.models.appointment import Appointment
from app.models.enums import PatientStatus
from app.models.invoice import Invoice
from app.models.package import Package
from app.models.patient import Patient
from app.models.therapist import Therapist
from app.models.user import User
from app.schemas.patient import (
    PatientCreate,
    PatientDetailResponse,
    PatientInvoiceItem,
    PatientResponse,
    PatientSessionItem,
    PatientUpdate,
)
from app.services.activity import log_activity


class PatientError(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        super().__init__(status_code=status_code, detail=detail)


def _get_therapist(session: Session, therapist_id: int) -> Therapist:
    therapist = session.get(Therapist, therapist_id)
    if therapist is None:
        raise PatientError("Therapist not found", status.HTTP_404_NOT_FOUND)
    if not therapist.is_active:
        raise PatientError("Therapist is inactive")
    return therapist


def _get_package(session: Session, package_id: int) -> Package:
    package = session.get(Package, package_id)
    if package is None:
        raise PatientError("Package not found", status.HTTP_404_NOT_FOUND)
    if not package.is_active:
        raise PatientError("Package is inactive")
    return package


def to_response(
    patient: Patient,
    *,
    therapist_name: str,
    package_name: str,
) -> PatientResponse:
    return PatientResponse(
        id=patient.id,  # type: ignore[arg-type]
        full_name=patient.full_name,
        phone=patient.phone,
        age=patient.age,
        gender=patient.gender,
        address=patient.address,
        condition=patient.condition,
        therapist_id=patient.therapist_id,
        therapist_name=therapist_name,
        package_id=patient.package_id,
        package_name=package_name,
        status=patient.status,
    )


def _names_for(
    session: Session, patients: list[Patient]
) -> tuple[dict[int, str], dict[int, str]]:
    therapist_ids = {p.therapist_id for p in patients}
    package_ids = {p.package_id for p in patients}
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
    return therapists, packages


def list_patients(
    session: Session,
    *,
    q: str | None = None,
    therapist_id: int | None = None,
    status_filter: PatientStatus | None = None,
) -> list[PatientResponse]:
    statement = select(Patient)
    if q:
        pattern = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                col(Patient.full_name).ilike(pattern),
                col(Patient.phone).ilike(pattern),
            )
        )
    if therapist_id is not None:
        statement = statement.where(Patient.therapist_id == therapist_id)
    if status_filter is not None:
        statement = statement.where(Patient.status == status_filter)
    statement = statement.order_by(col(Patient.created_at).desc())
    patients = list(session.exec(statement).all())
    therapists, packages = _names_for(session, patients)
    return [
        to_response(
            p,
            therapist_name=therapists.get(p.therapist_id, "—"),
            package_name=packages.get(p.package_id, "—"),
        )
        for p in patients
    ]


def get_patient(session: Session, patient_id: int) -> Patient:
    patient = session.get(Patient, patient_id)
    if patient is None:
        raise PatientError("Patient not found", status.HTTP_404_NOT_FOUND)
    return patient


def get_patient_detail(session: Session, patient_id: int) -> PatientDetailResponse:
    patient = get_patient(session, patient_id)
    therapist = session.get(Therapist, patient.therapist_id)
    package = session.get(Package, patient.package_id)

    appointments = session.exec(
        select(Appointment)
        .where(Appointment.patient_id == patient_id)
        .order_by(col(Appointment.appointment_date).desc(), col(Appointment.start_time).desc())
    ).all()
    therapist_ids = {a.therapist_id for a in appointments}
    therapist_names = {
        t.id: t.full_name
        for t in session.exec(select(Therapist).where(col(Therapist.id).in_(therapist_ids))).all()
        if t.id is not None
    } if therapist_ids else {}

    sessions = [
        PatientSessionItem(
            id=a.id,  # type: ignore[arg-type]
            appointment_date=str(a.appointment_date),
            start_time=a.start_time.strftime("%H:%M"),
            end_time=a.end_time.strftime("%H:%M"),
            therapist_id=a.therapist_id,
            therapist_name=therapist_names.get(a.therapist_id, "—"),
            status=a.status.value if hasattr(a.status, "value") else str(a.status),
            payment_method=(
                a.payment_method.value
                if hasattr(a.payment_method, "value")
                else str(a.payment_method)
            ),
            notes=a.notes,
        )
        for a in appointments
    ]

    invoices = session.exec(
        select(Invoice)
        .where(Invoice.patient_id == patient_id)
        .order_by(col(Invoice.issued_on).desc())
    ).all()
    package_ids = {inv.package_id for inv in invoices}
    package_names = {
        pkg.id: pkg.name
        for pkg in session.exec(select(Package).where(col(Package.id).in_(package_ids))).all()
        if pkg.id is not None
    } if package_ids else {}

    invoice_items = [
        PatientInvoiceItem(
            id=inv.id,  # type: ignore[arg-type]
            invoice_number=inv.invoice_number,
            issued_on=str(inv.issued_on),
            package_name=package_names.get(inv.package_id, "—"),
            amount=str(inv.amount),
            discount=str(inv.discount),
            net_amount=str((inv.amount - inv.discount).quantize(Decimal("0.01"))),
            status=inv.status.value if hasattr(inv.status, "value") else str(inv.status),
            payment_method=(
                inv.payment_method.value
                if hasattr(inv.payment_method, "value")
                else str(inv.payment_method)
            ),
        )
        for inv in invoices
    ]

    base = to_response(
        patient,
        therapist_name=therapist.full_name if therapist else "—",
        package_name=package.name if package else "—",
    )
    return PatientDetailResponse(**base.model_dump(), sessions=sessions, invoices=invoice_items)


def create_patient(session: Session, data: PatientCreate, actor: User) -> PatientResponse:
    therapist = _get_therapist(session, data.therapist_id)
    package = _get_package(session, data.package_id)
    patient = Patient(
        full_name=data.full_name.strip(),
        phone=data.phone.strip(),
        age=data.age,
        gender=data.gender,
        address=data.address.strip(),
        condition=data.condition.strip(),
        therapist_id=data.therapist_id,
        package_id=data.package_id,
        status=data.status,
    )
    session.add(patient)
    session.flush()
    log_activity(
        session,
        actor=actor,
        action="patient.created",
        entity_type="patient",
        entity_id=patient.id,
        summary=f"Created patient {patient.full_name}",
    )
    session.commit()
    session.refresh(patient)
    return to_response(
        patient,
        therapist_name=therapist.full_name,
        package_name=package.name,
    )


def update_patient(
    session: Session,
    patient_id: int,
    data: PatientUpdate,
    actor: User,
) -> PatientResponse:
    patient = get_patient(session, patient_id)
    payload = data.model_dump(exclude_unset=True)

    if "therapist_id" in payload and payload["therapist_id"] != patient.therapist_id:
        _get_therapist(session, payload["therapist_id"])
    elif "therapist_id" in payload and session.get(Therapist, payload["therapist_id"]) is None:
        raise PatientError("Therapist not found", status.HTTP_404_NOT_FOUND)

    if "package_id" in payload and payload["package_id"] != patient.package_id:
        _get_package(session, payload["package_id"])
    elif "package_id" in payload and session.get(Package, payload["package_id"]) is None:
        raise PatientError("Package not found", status.HTTP_404_NOT_FOUND)

    for key, value in payload.items():
        if key in {"full_name", "phone", "address", "condition"} and isinstance(value, str):
            value = value.strip()
        setattr(patient, key, value)

    session.add(patient)
    log_activity(
        session,
        actor=actor,
        action="patient.updated",
        entity_type="patient",
        entity_id=patient.id,
        summary=f"Updated patient {patient.full_name}",
    )
    session.commit()
    session.refresh(patient)

    therapist = session.get(Therapist, patient.therapist_id)
    package = session.get(Package, patient.package_id)
    return to_response(
        patient,
        therapist_name=therapist.full_name if therapist else "—",
        package_name=package.name if package else "—",
    )


def delete_patient(session: Session, patient_id: int, actor: User) -> None:
    patient = get_patient(session, patient_id)
    name = patient.full_name
    # Block delete if invoices exist (RESTRICT FK) — delete invoices first or reject
    invoice_count = len(
        session.exec(select(Invoice).where(Invoice.patient_id == patient_id)).all()
    )
    if invoice_count > 0:
        raise PatientError(
            "Cannot delete patient with invoices. Remove or void invoices first.",
            status.HTTP_409_CONFLICT,
        )
    session.delete(patient)
    log_activity(
        session,
        actor=actor,
        action="patient.deleted",
        entity_type="patient",
        entity_id=patient_id,
        summary=f"Deleted patient {name}",
    )
    session.commit()
