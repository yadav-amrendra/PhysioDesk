from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlmodel import Session, col, select

from app.models.appointment import Appointment
from app.models.enums import InvoiceStatus
from app.models.invoice import Invoice
from app.models.package import Package
from app.models.patient import Patient
from app.models.user import User
from app.schemas.billing import InvoiceCreate, InvoiceResponse, InvoiceUpdate
from app.services.activity import log_activity


class BillingError(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        super().__init__(status_code=status_code, detail=detail)


def _net(amount: Decimal, discount: Decimal) -> Decimal:
    return (amount - discount).quantize(Decimal("0.01"))


def _paid_at_date(value: datetime | None) -> date | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).date()
    return value.date()


def to_response(
    invoice: Invoice,
    *,
    patient_name: str,
    package_name: str,
) -> InvoiceResponse:
    return InvoiceResponse(
        id=invoice.id,  # type: ignore[arg-type]
        invoice_number=invoice.invoice_number,
        patient_id=invoice.patient_id,
        patient_name=patient_name,
        package_id=invoice.package_id,
        package_name=package_name,
        appointment_id=invoice.appointment_id,
        created_by_user_id=invoice.created_by_user_id,
        amount=invoice.amount,
        discount=invoice.discount,
        net_amount=_net(invoice.amount, invoice.discount),
        status=invoice.status,
        payment_method=invoice.payment_method,
        issued_on=invoice.issued_on,
        paid_at=_paid_at_date(invoice.paid_at),
        notes=invoice.notes,
    )


def _next_invoice_number(session: Session, issued_on: date) -> str:
    year = issued_on.year
    prefix = f"INV-{year}-"
    last = session.exec(
        select(Invoice)
        .where(col(Invoice.invoice_number).like(f"{prefix}%"))
        .order_by(col(Invoice.invoice_number).desc())
    ).first()
    seq = 1
    if last is not None:
        try:
            seq = int(last.invoice_number.rsplit("-", 1)[-1]) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:04d}"


def list_invoices(
    session: Session,
    *,
    status_filter: InvoiceStatus | None = None,
    patient_id: int | None = None,
    q: str | None = None,
) -> list[InvoiceResponse]:
    statement = select(Invoice)
    if status_filter is not None:
        statement = statement.where(Invoice.status == status_filter)
    if patient_id is not None:
        statement = statement.where(Invoice.patient_id == patient_id)
    statement = statement.order_by(col(Invoice.issued_on).desc(), col(Invoice.id).desc())
    invoices = list(session.exec(statement).all())

    patient_ids = {i.patient_id for i in invoices}
    package_ids = {i.package_id for i in invoices}
    patients = {
        p.id: p.full_name
        for p in session.exec(select(Patient).where(col(Patient.id).in_(patient_ids))).all()
        if p.id is not None
    } if patient_ids else {}
    packages = {
        pkg.id: pkg.name
        for pkg in session.exec(select(Package).where(col(Package.id).in_(package_ids))).all()
        if pkg.id is not None
    } if package_ids else {}

    rows = [
        to_response(
            inv,
            patient_name=patients.get(inv.patient_id, "—"),
            package_name=packages.get(inv.package_id, "—"),
        )
        for inv in invoices
    ]
    if q:
        needle = q.strip().lower()
        rows = [
            r
            for r in rows
            if needle in r.invoice_number.lower()
            or needle in r.patient_name.lower()
            or needle in r.package_name.lower()
        ]
    return rows


def get_invoice(session: Session, invoice_id: int) -> Invoice:
    invoice = session.get(Invoice, invoice_id)
    if invoice is None:
        raise BillingError("Invoice not found", status.HTTP_404_NOT_FOUND)
    return invoice


def get_invoice_response(session: Session, invoice_id: int) -> InvoiceResponse:
    invoice = get_invoice(session, invoice_id)
    patient = session.get(Patient, invoice.patient_id)
    package = session.get(Package, invoice.package_id)
    return to_response(
        invoice,
        patient_name=patient.full_name if patient else "—",
        package_name=package.name if package else "—",
    )


def create_invoice(session: Session, data: InvoiceCreate, actor: User) -> InvoiceResponse:
    patient = session.get(Patient, data.patient_id)
    if patient is None:
        raise BillingError("Patient not found", status.HTTP_404_NOT_FOUND)

    package = session.get(Package, data.package_id)
    if package is None or not package.is_active:
        raise BillingError("Package not found or inactive", status.HTTP_404_NOT_FOUND)

    if data.appointment_id is not None:
        appt = session.get(Appointment, data.appointment_id)
        if appt is None:
            raise BillingError("Appointment not found", status.HTTP_404_NOT_FOUND)
        if appt.patient_id != data.patient_id:
            raise BillingError("Appointment does not belong to this patient")

    issued_on = data.issued_on or date.today()
    amount = data.amount if data.amount is not None else package.price
    discount = data.discount
    if discount > amount:
        raise BillingError("discount cannot exceed amount")

    status_value = data.status
    paid_at = datetime.now(timezone.utc) if status_value == InvoiceStatus.PAID else None

    assert actor.id is not None
    invoice = Invoice(
        invoice_number=_next_invoice_number(session, issued_on),
        patient_id=data.patient_id,
        package_id=data.package_id,
        appointment_id=data.appointment_id,
        created_by_user_id=actor.id,
        amount=amount,
        discount=discount,
        status=status_value,
        payment_method=data.payment_method,
        issued_on=issued_on,
        paid_at=paid_at,
        notes=data.notes.strip() if data.notes else None,
    )
    session.add(invoice)
    session.flush()
    log_activity(
        session,
        actor=actor,
        action="invoice.created",
        entity_type="invoice",
        entity_id=invoice.id,
        summary=f"Created {invoice.invoice_number} for {patient.full_name}",
    )
    session.commit()
    session.refresh(invoice)
    return to_response(invoice, patient_name=patient.full_name, package_name=package.name)


def update_invoice(
    session: Session,
    invoice_id: int,
    data: InvoiceUpdate,
    actor: User,
) -> InvoiceResponse:
    invoice = get_invoice(session, invoice_id)
    payload = data.model_dump(exclude_unset=True)
    if not payload:
        return get_invoice_response(session, invoice_id)

    if "package_id" in payload:
        package = session.get(Package, payload["package_id"])
        if package is None:
            raise BillingError("Package not found", status.HTTP_404_NOT_FOUND)
        invoice.package_id = payload["package_id"]

    if "appointment_id" in payload:
        appt_id = payload["appointment_id"]
        if appt_id is not None:
            appt = session.get(Appointment, appt_id)
            if appt is None:
                raise BillingError("Appointment not found", status.HTTP_404_NOT_FOUND)
            if appt.patient_id != invoice.patient_id:
                raise BillingError("Appointment does not belong to this patient")
        invoice.appointment_id = appt_id

    if "amount" in payload:
        invoice.amount = payload["amount"]
    if "discount" in payload:
        invoice.discount = payload["discount"]
    if invoice.discount > invoice.amount:
        raise BillingError("discount cannot exceed amount")

    if "payment_method" in payload:
        invoice.payment_method = payload["payment_method"]
    if "issued_on" in payload:
        invoice.issued_on = payload["issued_on"]
    if "notes" in payload:
        notes = payload["notes"]
        invoice.notes = notes.strip() if isinstance(notes, str) and notes else notes

    old_status = invoice.status
    if "status" in payload:
        new_status = payload["status"]
        invoice.status = new_status
        if new_status == InvoiceStatus.PAID and old_status != InvoiceStatus.PAID:
            invoice.paid_at = datetime.now(timezone.utc)
        elif new_status == InvoiceStatus.DUE:
            invoice.paid_at = None

    session.add(invoice)
    action = (
        "invoice.marked_paid"
        if old_status != InvoiceStatus.PAID and invoice.status == InvoiceStatus.PAID
        else "invoice.updated"
    )
    log_activity(
        session,
        actor=actor,
        action=action,
        entity_type="invoice",
        entity_id=invoice.id,
        summary=f"Updated {invoice.invoice_number}",
        metadata={
            "old_status": old_status.value if hasattr(old_status, "value") else str(old_status),
            "new_status": invoice.status.value
            if hasattr(invoice.status, "value")
            else str(invoice.status),
        },
    )
    session.commit()
    session.refresh(invoice)
    patient = session.get(Patient, invoice.patient_id)
    package = session.get(Package, invoice.package_id)
    return to_response(
        invoice,
        patient_name=patient.full_name if patient else "—",
        package_name=package.name if package else "—",
    )


def delete_invoice(session: Session, invoice_id: int, actor: User) -> None:
    invoice = get_invoice(session, invoice_id)
    number = invoice.invoice_number
    session.delete(invoice)
    log_activity(
        session,
        actor=actor,
        action="invoice.deleted",
        entity_type="invoice",
        entity_id=invoice_id,
        summary=f"Voided/deleted {number}",
    )
    session.commit()
