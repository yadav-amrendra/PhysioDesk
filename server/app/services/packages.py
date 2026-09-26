from sqlmodel import Session, select

from app.models.package import Package
from app.schemas.package import PackageResponse


def list_packages(session: Session, *, active_only: bool = True) -> list[PackageResponse]:
    statement = select(Package)
    if active_only:
        statement = statement.where(Package.is_active == True)  # noqa: E712
    statement = statement.order_by(Package.name)
    return [PackageResponse.model_validate(p) for p in session.exec(statement).all()]
