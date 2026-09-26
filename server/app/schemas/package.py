from decimal import Decimal

from pydantic import BaseModel, Field


class PackageResponse(BaseModel):
    id: int
    name: str
    session_count: int
    price: Decimal
    description: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class PackageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    session_count: int = Field(default=1, ge=1)
    price: Decimal = Field(ge=0)
    description: str | None = None
    is_active: bool = True
