from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException, status
from sqlmodel import Session, col, select

from app.core.security import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import TokenResponse


class AuthError(HTTPException):
    def __init__(self, detail: str = "Could not validate credentials") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_user_by_email(session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()


def authenticate_user(session: Session, email: str, password: str) -> User:
    user = get_user_by_email(session, email)
    if user is None or not verify_password(password, user.hashed_password):
        raise AuthError("Incorrect email or password")
    if not user.is_active:
        raise AuthError("Inactive user")
    return user


def _role_str(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def issue_tokens(session: Session, user: User) -> TokenResponse:
    subject = str(user.id)
    role = _role_str(user)
    jti = uuid4().hex
    refresh = create_refresh_token(subject=subject, role=role, jti=jti)
    payload = decode_token(refresh)
    expires_at = datetime.fromtimestamp(payload["exp"], tz=UTC)

    session.add(
        RefreshToken(
            user_id=user.id,  # type: ignore[arg-type]
            jti=jti,
            token_hash=hash_token(refresh),
            expires_at=expires_at,
        )
    )
    session.commit()

    return TokenResponse(
        access_token=create_access_token(subject=subject, role=role),
        refresh_token=refresh,
    )


def _revoke_all_for_user(session: Session, user_id: int) -> None:
    now = datetime.now(UTC)
    rows = session.exec(
        select(RefreshToken)
        .where(RefreshToken.user_id == user_id)
        .where(col(RefreshToken.revoked_at).is_(None))
    ).all()
    for row in rows:
        row.revoked_at = now
        session.add(row)
    session.commit()


def refresh_tokens(session: Session, refresh_token: str) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except Exception as exc:
        raise AuthError("Invalid refresh token") from exc

    if payload.get("type") != TokenType.REFRESH.value:
        raise AuthError("Invalid token type")

    subject = payload.get("sub")
    jti = payload.get("jti")
    if subject is None or jti is None:
        raise AuthError("Invalid refresh token")

    user = session.get(User, int(subject))
    if user is None or not user.is_active:
        raise AuthError("User not found or inactive")

    stored = session.exec(select(RefreshToken).where(RefreshToken.jti == jti)).first()
    if stored is None:
        raise AuthError("Invalid refresh token")

    # Reuse of a rotated token → revoke all sessions for this user.
    if stored.revoked_at is not None:
        if stored.replaced_by_jti is not None:
            _revoke_all_for_user(session, user.id)  # type: ignore[arg-type]
            raise AuthError("Refresh token reuse detected; all sessions revoked")
        raise AuthError("Invalid refresh token")

    expires_at = stored.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        stored.revoked_at = datetime.now(UTC)
        session.add(stored)
        session.commit()
        raise AuthError("Refresh token expired")

    if stored.token_hash != hash_token(refresh_token):
        _revoke_all_for_user(session, user.id)  # type: ignore[arg-type]
        raise AuthError("Invalid refresh token")

    # Rotate: revoke current, issue a new pair.
    new_jti = uuid4().hex
    role = _role_str(user)
    new_refresh = create_refresh_token(subject=str(user.id), role=role, jti=new_jti)
    new_payload = decode_token(new_refresh)
    new_expires = datetime.fromtimestamp(new_payload["exp"], tz=UTC)

    now = datetime.now(UTC)
    stored.revoked_at = now
    stored.replaced_by_jti = new_jti
    session.add(stored)
    session.add(
        RefreshToken(
            user_id=user.id,  # type: ignore[arg-type]
            jti=new_jti,
            token_hash=hash_token(new_refresh),
            expires_at=new_expires,
        )
    )
    session.commit()

    return TokenResponse(
        access_token=create_access_token(subject=str(user.id), role=role),
        refresh_token=new_refresh,
    )


def logout(session: Session, refresh_token: str) -> None:
    """Revoke the given refresh token (best-effort; always succeeds from client POV)."""
    try:
        payload = decode_token(refresh_token)
    except Exception:
        return

    jti = payload.get("jti")
    if not jti:
        return

    stored = session.exec(select(RefreshToken).where(RefreshToken.jti == jti)).first()
    if stored is None or stored.revoked_at is not None:
        return

    stored.revoked_at = datetime.now(UTC)
    session.add(stored)
    session.commit()


def logout_everywhere(session: Session, user: User) -> int:
    """Revoke all refresh tokens for the user. Returns count revoked."""
    now = datetime.now(UTC)
    active = list(
        session.exec(
            select(RefreshToken)
            .where(RefreshToken.user_id == user.id)
            .where(col(RefreshToken.revoked_at).is_(None))
        ).all()
    )
    for row in active:
        row.revoked_at = now
        session.add(row)
    session.commit()
    return len(active)
