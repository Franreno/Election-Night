from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.geography import RegionDetail, RegionListResponse
from app.services.geography_service import get_all_regions, get_region_detail

router = APIRouter(prefix="/api/geography", tags=["geography"])


@router.get("/regions", response_model=RegionListResponse)
def list_regions(db: Session = Depends(get_db)):
    """List all regions with constituency counts."""
    return get_all_regions(db)


@router.get("/regions/{region_id}", response_model=RegionDetail)
def get_region(region_id: int, db: Session = Depends(get_db)):
    """Get region detail with all constituencies and pcon24 codes."""
    result = get_region_detail(db, region_id)
    if not result:
        raise HTTPException(status_code=404, detail="Region not found")
    return result
