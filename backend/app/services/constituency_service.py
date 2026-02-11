from sqlalchemy.orm import Session, joinedload

from app.constants import PARTY_CODE_MAP
from app.models.constituency import Constituency


def get_all_constituencies(
    db: Session,
    search: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    query = db.query(Constituency).options(joinedload(Constituency.results))

    if search:
        query = query.filter(Constituency.name.ilike(f"%{search}%"))

    # Count before pagination (on the base query without joinedload for accuracy)
    count_query = db.query(Constituency)
    if search:
        count_query = count_query.filter(
            Constituency.name.ilike(f"%{search}%"))
    total = count_query.count()

    constituencies = (query.order_by(Constituency.name).offset(
        (page - 1) * page_size).limit(page_size).all())

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "constituencies": [_format_constituency(c) for c in constituencies],
    }


def get_constituency_by_id(db: Session, constituency_id: int) -> dict | None:
    constituency = (db.query(Constituency).options(
        joinedload(Constituency.results)).filter(
            Constituency.id == constituency_id).first())
    if not constituency:
        return None
    return _format_constituency(constituency)


def _format_constituency(constituency: Constituency) -> dict:
    """Format a constituency with computed vote percentages and winner."""
    total_votes = sum(r.votes for r in constituency.results)

    parties = []
    max_votes = -1
    winner_code = None
    is_tied = False

    for r in constituency.results:
        pct = round(
            (r.votes / total_votes * 100), 2) if total_votes > 0 else 0.0
        parties.append({
            "party_code":
            r.party_code,
            "party_name":
            PARTY_CODE_MAP.get(r.party_code, r.party_code),
            "votes":
            r.votes,
            "percentage":
            pct,
        })
        if r.votes > max_votes:
            max_votes = r.votes
            winner_code = r.party_code
            is_tied = False
        elif r.votes == max_votes:
            is_tied = True

    # No winner if there's a tie
    if is_tied:
        winner_code = None

    parties.sort(key=lambda p: p["votes"], reverse=True)

    return {
        "id":
        constituency.id,
        "name":
        constituency.name,
        "total_votes":
        total_votes,
        "winning_party_code":
        winner_code,
        "winning_party_name":
        PARTY_CODE_MAP.get(winner_code, winner_code) if winner_code else None,
        "parties":
        parties,
    }
