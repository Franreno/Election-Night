from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.totals import TotalResultsResponse
from app.services.totals_service import get_total_results

router = APIRouter(prefix="/api/totals", tags=["totals"])


@router.get("", response_model=TotalResultsResponse)
def total_results(db: Session = Depends(get_db)):
    """Get national aggregated election results.

    Returns total votes per party and seat (MP) counts based on
    first-past-the-post in each constituency.
    """
    return get_total_results(db)
