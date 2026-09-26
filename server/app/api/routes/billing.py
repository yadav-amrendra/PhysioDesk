from fastapi import APIRouter, Query, Response, status

from app.api.deps import AdminUser, CurrentUser, SessionDep
from app.models.enums import InvoiceStatus
from app.schemas.billing import InvoiceCreate, InvoiceResponse, InvoiceUpdate
from app.services import billing as billing_service

router = APIRouter(prefix="/invoices", tags=["billing"])


@router.get("", response_model=list[InvoiceResponse])
def list_invoices(
    session: SessionDep,
    _user: CurrentUser,
    status_filter: InvoiceStatus | None = Query(default=None, alias="status"),
    patient_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
) -> list[InvoiceResponse]:
    """Admin + staff can read invoices (staff is read-only on writes)."""
    return billing_service.list_invoices(
        session, status_filter=status_filter, patient_id=patient_id, q=q
    )


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    body: InvoiceCreate,
    session: SessionDep,
    admin: AdminUser,
) -> InvoiceResponse:
    return billing_service.create_invoice(session, body, admin)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    session: SessionDep,
    _user: CurrentUser,
) -> InvoiceResponse:
    return billing_service.get_invoice_response(session, invoice_id)


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    body: InvoiceUpdate,
    session: SessionDep,
    admin: AdminUser,
) -> InvoiceResponse:
    return billing_service.update_invoice(session, invoice_id, body, admin)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
    invoice_id: int,
    session: SessionDep,
    admin: AdminUser,
) -> Response:
    billing_service.delete_invoice(session, invoice_id, admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
