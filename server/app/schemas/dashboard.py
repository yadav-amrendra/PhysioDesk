from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import PatientStatus


class DashboardStats(BaseModel):
    patients_seen_today: int
    therapists_on_duty: int
    revenue_today: Decimal
    open_slots_today: int


class TherapistCapacityItem(BaseModel):
    therapist_id: int
    therapist_name: str
    specialty: str
    total_slots: int
    booked_slots: int
    open_slots: int
    booked_ratio: float


class RecentPatientItem(BaseModel):
    id: int
    full_name: str
    condition: str
    therapist_name: str
    package_name: str
    status: PatientStatus


class DashboardResponse(BaseModel):
    date: date
    stats: DashboardStats
    capacity: list[TherapistCapacityItem]
    recent_patients: list[RecentPatientItem]
