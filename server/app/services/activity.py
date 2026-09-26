"""Append-only activity / audit logging."""

from typing import Any

from sqlmodel import Session

from app.models.activity_log import ActivityLog
from app.models.user import User


def log_activity(
    session: Session,
    *,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    summary: str,
    metadata: dict[str, Any] | None = None,
) -> ActivityLog:
    """Record a high-level action in the same DB transaction as the caller."""
    entry = ActivityLog(
        actor_user_id=actor.id if actor is not None else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary,
        metadata_=metadata,
    )
    session.add(entry)
    return entry
