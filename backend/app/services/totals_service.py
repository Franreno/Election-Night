from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.constants import PARTY_CODE_MAP
from app.models.constituency import Constituency
from app.models.result import Result
from app.models.upload_log import UploadLog


def _active_result_filter():
    """Filter condition: result's upload is not soft-deleted 
       (or has no upload)."""
    return or_(Result.upload_id.is_(None), UploadLog.deleted_at.is_(None))


def get_total_results(db: Session) -> dict:
    """Compute national aggregated results.

    - Total votes per party: SUM of all votes grouped by party_code
    - Seats per party: count of constituencies where that party has the sole
      highest votes (tied constituencies award no seat)

    Results from soft-deleted uploads are excluded.
    """
    # Base: only active (non-soft-deleted) results
    active_results = (db.query(Result).outerjoin(
        UploadLog, Result.upload_id == UploadLog.id).filter(
            _active_result_filter()).subquery())

    # Total votes per party
    votes_query = (db.query(
        active_results.c.party_code,
        func.sum(active_results.c.votes).label("total_votes"),
    ).group_by(active_results.c.party_code).all())

    # Seats: find the winning party in each constituency
    # Step 1: max votes per constituency
    max_votes_sub = (db.query(
        active_results.c.constituency_id,
        func.max(active_results.c.votes).label("max_votes"),
    ).group_by(active_results.c.constituency_id).subquery())

    # Step 2: count how many parties share the max in each constituency
    # (to exclude ties)
    tie_count_sub = (db.query(
        active_results.c.constituency_id,
        func.count().label("winner_count"),
    ).join(
        max_votes_sub,
        (active_results.c.constituency_id == max_votes_sub.c.constituency_id) &
        (active_results.c.votes == max_votes_sub.c.max_votes),
    ).group_by(active_results.c.constituency_id).subquery())

    # Step 3: join results with max_votes and filter to sole winners only
    winners_query = (db.query(
        active_results.c.party_code,
        func.count().label("seats")
    ).join(
        max_votes_sub,
        (active_results.c.constituency_id == max_votes_sub.c.constituency_id) &
        (active_results.c.votes == max_votes_sub.c.max_votes),
    ).join(
        tie_count_sub,
        active_results.c.constituency_id == tie_count_sub.c.constituency_id,
    ).filter(tie_count_sub.c.winner_count == 1).group_by(
        active_results.c.party_code).all())

    votes_map = {row.party_code: row.total_votes for row in votes_query}
    seats_map = {row.party_code: row.seats for row in winners_query}
    all_parties = set(votes_map.keys()) | set(seats_map.keys())

    parties = []
    for code in all_parties:
        parties.append({
            "party_code": code,
            "party_name": PARTY_CODE_MAP.get(code, code),
            "total_votes": votes_map.get(code, 0),
            "seats": seats_map.get(code, 0),
        })

    parties.sort(key=lambda p: (-p["seats"], -p["total_votes"]))

    total_constituencies = db.query(func.count(Constituency.id)).scalar() or 0

    return {
        "total_constituencies": total_constituencies,
        "total_votes": sum(votes_map.values()),
        "parties": parties,
    }
