from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.constants import PARTY_CODE_MAP
from app.models.constituency import Constituency
from app.models.result import Result


def _build_sort_clause(sort_by: str | None, sort_dir: str):
    """Return an ORDER BY clause for the given sort field."""
    is_desc = sort_dir == "desc"

    if sort_by == "total_votes":
        sub = (select(func.coalesce(
            func.sum(Result.votes),
            0)).where(Result.constituency_id == Constituency.id).correlate(
                Constituency).scalar_subquery())
        return sub.desc() if is_desc else sub.asc()

    if sort_by == "winning_party":
        # Subquery: party_code of the result with the most votes
        sub = (select(Result.party_code).where(
            Result.constituency_id == Constituency.id).correlate(
                Constituency).order_by(
                    Result.votes.desc()).limit(1).scalar_subquery())
        return sub.desc() if is_desc else sub.asc()

    # Default: sort by name
    col = Constituency.name
    return col.desc() if is_desc else col.asc()


def get_all_constituencies(
    db: Session,
    search: str | None = None,
    region_ids: list[int] | None = None,
    page: int = 1,
    page_size: int = 50,
    sort_by: str | None = None,
    sort_dir: str = "asc",
) -> dict:
    query = db.query(Constituency).options(
        joinedload(Constituency.results),
        joinedload(Constituency.region),
    )

    if search:
        query = query.filter(Constituency.name.ilike(f"%{search}%"))

    if region_ids:
        query = query.filter(Constituency.region_id.in_(region_ids))

    # Count before pagination (on the base query without joinedload for accuracy)
    count_query = db.query(Constituency)
    if search:
        count_query = count_query.filter(
            Constituency.name.ilike(f"%{search}%"))
    if region_ids:
        count_query = count_query.filter(Constituency.region_id.in_(region_ids))
    total = count_query.count()

    order = _build_sort_clause(sort_by, sort_dir)

    constituencies = (query.order_by(order).offset(
        (page - 1) * page_size).limit(page_size).all())

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "constituencies": [_format_constituency(c) for c in constituencies],
    }


def get_all_constituencies_summary(db: Session) -> dict:
    """Return all constituencies with just id, name, and winning party code."""
    constituencies = (db.query(Constituency).options(
        joinedload(Constituency.results),
        joinedload(Constituency.region),
    ).order_by(Constituency.name.asc()).all())

    summaries = []
    for c in constituencies:
        winner_code = None
        max_votes = -1
        is_tied = False
        for r in c.results:
            if r.votes > max_votes:
                max_votes = r.votes
                winner_code = r.party_code
                is_tied = False
            elif r.votes == max_votes:
                is_tied = True
        if is_tied:
            winner_code = None
        summaries.append({
            "id": c.id,
            "name": c.name,
            "pcon24_code": c.pcon24_code,
            "region_id": c.region_id,
            "region_name": c.region.name if c.region else None,
            "winning_party_code": winner_code,
        })

    return {
        "total": len(summaries),
        "constituencies": summaries,
    }


def get_constituency_by_id(db: Session, constituency_id: int) -> dict | None:
    constituency = (db.query(Constituency).options(
        joinedload(Constituency.results),
        joinedload(Constituency.region),
    ).filter(Constituency.id == constituency_id).first())
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
        "pcon24_code":
        constituency.pcon24_code,
        "region_id":
        constituency.region_id,
        "region_name":
        constituency.region.name if constituency.region else None,
        "total_votes":
        total_votes,
        "winning_party_code":
        winner_code,
        "winning_party_name":
        PARTY_CODE_MAP.get(winner_code, winner_code) if winner_code else None,
        "parties":
        parties,
    }
