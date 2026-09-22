from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: SessionDep) -> TokenResponse:
    user = auth_service.authenticate_user(session, body.email, body.password)
    return auth_service.issue_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, session: SessionDep) -> TokenResponse:
    return auth_service.refresh_tokens(session, body.refresh_token)


@router.get("/me", response_model=UserResponse)
def me(current_user: CurrentUser) -> User:
    return current_user
