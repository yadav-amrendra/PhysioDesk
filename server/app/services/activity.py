"""Append-only activity / audit logging."""

from typing import Any

from sqlmodel import Session, col, func, select

from app.models.activity_log import ActivityLog
from app.models.user import User
from app.schemas.activity import ActivityLogResponse
from app.schemas.pagination import Page, clamp_pagination, make_page


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


def _to_response(entry: ActivityLog, actor_name: str | None) -> ActivityLogResponse:
    assert entry.id is not None
    assert entry.created_at is not None
    return ActivityLogResponse(
        id=entry.id,
        actor_user_id=entry.actor_user_id,
        actor_name=actor_name,
        action=entry.action,
        entity_type=entry.entity_type,
        entity_id=entry.entity_id,
        summary=entry.summary,
        metadata=entry.metadata_,
        created_at=entry.created_at,
    )


def list_activity_logs(
    session: Session,
    *,
    entity_type: str | None = None,
    action: str | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> Page[ActivityLogResponse]:
    page, page_size, offset = clamp_pagination(page, page_size)

    stmt = select(ActivityLog)
    count_stmt = select(func.count()).select_from(ActivityLog)

    if entity_type:
        stmt = stmt.where(ActivityLog.entity_type == entity_type)
        count_stmt = count_stmt.where(ActivityLog.entity_type == entity_type)
    if action:
        stmt = stmt.where(ActivityLog.action == action)
        count_stmt = count_stmt.where(ActivityLog.action == action)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(col(ActivityLog.summary).ilike(like))
        count_stmt = count_stmt.where(col(ActivityLog.summary).ilike(like))

    total = int(session.exec(count_stmt).one())
    rows = session.exec(
        stmt.order_by(col(ActivityLog.created_at).desc(), col(ActivityLog.id).desc())
        .offset(offset)
        .limit(page_size)
    ).all()

    actor_ids = {r.actor_user_id for r in rows if r.actor_user_id is not None}
    actors: dict[int, str] = {}
    if actor_ids:
        for user in session.exec(select(User).where(col(User.id).in_(actor_ids))).all():
            if user.id is not None:
                actors[user.id] = user.full_name

    items = [
        _to_response(row, actors.get(row.actor_user_id) if row.actor_user_id else None)
        for row in rows
    ]
    return make_page(items=items, total=total, page=page, page_size=page_size)


def recent_activity_logs(session: Session, *, limit: int = 8) -> list[ActivityLogResponse]:
    rows = session.exec(
        select(ActivityLog)
        .order_by(col(ActivityLog.created_at).desc(), col(ActivityLog.id).desc())
        .limit(limit)
    ).all()
    actor_ids = {r.actor_user_id for r in rows if r.actor_user_id is not None}
    actors: dict[int, str] = {}
    if actor_ids:
        for user in session.exec(select(User).where(col(User.id).in_(actor_ids))).all():
            if user.id is not None:
                actors[user.id] = user.full_name
    return [
        _to_response(row, actors.get(row.actor_user_id) if row.actor_user_id else None)
        for row in rows
    ]
