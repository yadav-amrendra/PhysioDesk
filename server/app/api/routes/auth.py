from fastapi import APIRouter, status

from app.api.deps import CurrentUser, SessionDep
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: SessionDep) -> TokenResponse:
    user = auth_service.authenticate_user(session, body.email, body.password)
    return auth_service.issue_tokens(session, user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, session: SessionDep) -> TokenResponse:
    return auth_service.refresh_tokens(session, body.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: LogoutRequest, session: SessionDep) -> None:
    """Revoke the provided refresh token (this device / session)."""
    auth_service.logout(session, body.refresh_token)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(session: SessionDep, user: CurrentUser) -> None:
    """Revoke all refresh tokens for the current user (logout everywhere)."""
    auth_service.logout_everywhere(session, user)


@router.get("/me", response_model=UserResponse)
def me(current_user: CurrentUser) -> User:
    return current_user
