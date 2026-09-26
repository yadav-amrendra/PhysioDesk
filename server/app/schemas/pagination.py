from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class Page(BaseModel, Generic[T]):
    items: list[T]
    page: int
    page_size: int
    total: int
    total_pages: int


def make_page(*, items: list[T], total: int, page: int, page_size: int) -> Page[T]:
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 0
    return Page(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


def clamp_pagination(
    page: int = 1,
    page_size: int = 20,
    *,
    max_page_size: int = 100,
) -> tuple[int, int, int]:
    """Return (page, page_size, offset)."""
    page = max(1, page)
    page_size = min(max(1, page_size), max_page_size)
    offset = (page - 1) * page_size
    return page, page_size, offset
