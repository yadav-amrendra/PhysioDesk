from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.router import api_router
from app.core.config import settings
from app.db.session import engine


def _verify_database() -> None:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise RuntimeError(
            "Cannot connect to PostgreSQL. Is Docker running? "
            "Try: docker compose up -d db"
        ) from exc


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    _verify_database()
    yield


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.get("/", tags=["root"])
    def root() -> dict[str, str]:
        return {
            "message": settings.app_name,
            "docs": "/docs",
            "health": f"{settings.api_v1_prefix}/health",
        }

    application.include_router(api_router, prefix=settings.api_v1_prefix)
    return application


app = create_app()
