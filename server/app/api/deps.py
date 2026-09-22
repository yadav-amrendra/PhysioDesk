from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.core.security import TokenType, decode_token
from app.db.session import get_session
from app.models.user import User, UserRole
from app.services.auth import AuthError

SessionDep = Annotated[Session, Depends(get_session)]

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    session: SessionDep,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthError("Not authenticated")

    try:
        payload = decode_token(credentials.credentials)
    except Exception as exc:
        raise AuthError("Invalid or expired access token") from exc

    if payload.get("type") != TokenType.ACCESS.value:
        raise AuthError("Invalid token type")

    subject = payload.get("sub")
    if subject is None:
        raise AuthError("Invalid access token")

    user = session.get(User, int(subject))
    if user is None or not user.is_active:
        raise AuthError("User not found or inactive")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    """Dependency factory — restrict a route to specific roles."""

    def _checker(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _checker


AdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
