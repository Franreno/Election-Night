from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.constituency import (
    ConstituencyListResponse,
    ConstituencyResponse,
)
from app.services.constituency_service import (
    get_all_constituencies,
    get_constituency_by_id,
)

router = APIRouter(prefix="/api/constituencies", tags=["constituencies"])


@router.get("", response_model=ConstituencyListResponse)
def list_constituencies(
        search: str | None = Query(None,
                                   description="Search constituency by name"),
        page: int = Query(1, ge=1),
        page_size: int = Query(50, ge=1, le=200),
        db: Session = Depends(get_db),
):
    """List all constituencies with their party results.

    Supports pagination and optional name search 
    (case-insensitive partial match).
    """
    return get_all_constituencies(db,
                                  search=search,
                                  page=page,
                                  page_size=page_size)


@router.get("/{constituency_id}", response_model=ConstituencyResponse)
def get_constituency(constituency_id: int, db: Session = Depends(get_db)):
    """Get detailed results for a single constituency."""
    result = get_constituency_by_id(db, constituency_id)
    if not result:
        raise HTTPException(status_code=404, detail="Constituency not found")
    return result
