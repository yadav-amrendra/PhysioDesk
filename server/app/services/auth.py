from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
    TokenType,
)
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


def issue_tokens(user: User) -> TokenResponse:
    subject = str(user.id)
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    return TokenResponse(
        access_token=create_access_token(subject=subject, role=role),
        refresh_token=create_refresh_token(subject=subject, role=role),
    )


def refresh_tokens(session: Session, refresh_token: str) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except Exception as exc:
        raise AuthError("Invalid refresh token") from exc

    if payload.get("type") != TokenType.REFRESH.value:
        raise AuthError("Invalid token type")

    subject = payload.get("sub")
    if subject is None:
        raise AuthError("Invalid refresh token")

    user = session.get(User, int(subject))
    if user is None or not user.is_active:
        raise AuthError("User not found or inactive")

    return issue_tokens(user)
