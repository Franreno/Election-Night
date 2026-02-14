from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.constituency import (
    ConstituencyListResponse,
    ConstituencyResponse,
    ConstituencySummaryListResponse,
)
from app.services.constituency_service import (
    get_all_constituencies,
    get_all_constituencies_summary,
    get_constituency_by_id,
)

router = APIRouter(prefix="/api/constituencies", tags=["constituencies"])


@router.get("", response_model=ConstituencyListResponse)
def list_constituencies(
        search: str | None = Query(None,
                                   description="Search constituency by name"),
        region_ids: str | None = Query(None,
                                       description="Comma-separated region IDs to filter by"),
        page: int = Query(1, ge=1),
        page_size: int = Query(50, ge=1, le=200),
        sort_by: Literal["name", "total_votes", "winning_party"]
    | None = Query(None, description="Sort field"),
        sort_dir: Literal["asc", "desc"] = Query("asc",
                                                 description="Sort direction"),
        db: Session = Depends(get_db),
):
    """List all constituencies with their party results.

    Supports pagination, optional name search
    (case-insensitive partial match), region filtering, and sorting.
    """
    # Parse region_ids from comma-separated string
    parsed_region_ids = None
    if region_ids:
        try:
            parsed_region_ids = [int(id.strip()) for id in region_ids.split(",") if id.strip()]
        except ValueError:
            parsed_region_ids = None

    return get_all_constituencies(db,
                                  search=search,
                                  region_ids=parsed_region_ids,
                                  page=page,
                                  page_size=page_size,
                                  sort_by=sort_by,
                                  sort_dir=sort_dir)


@router.get("/summary", response_model=ConstituencySummaryListResponse)
def list_constituencies_summary(db: Session = Depends(get_db)):
    """Return all constituencies with id, name, and winning party code.

    Lightweight unpaginated endpoint for the choropleth map.
    """
    return get_all_constituencies_summary(db)


@router.get("/{constituency_id}", response_model=ConstituencyResponse)
def get_constituency(constituency_id: int, db: Session = Depends(get_db)):
    """Get detailed results for a single constituency."""
    result = get_constituency_by_id(db, constituency_id)
    if not result:
        raise HTTPException(status_code=404, detail="Constituency not found")
    return result
