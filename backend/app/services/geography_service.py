from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.constituency import Constituency
from app.models.region import Region


def get_all_regions(db: Session) -> dict:
    rows = (db.query(
        Region.id,
        Region.name,
        Region.sort_order,
        func.count(Constituency.id).label("constituency_count"),
    ).outerjoin(Constituency, Constituency.region_id == Region.id).group_by(
        Region.id).order_by(Region.sort_order.asc()).all())
    return {
        "regions": [{
            "id": r.id,
            "name": r.name,
            "sort_order": r.sort_order,
            "constituency_count": r.constituency_count,
        } for r in rows]
    }


def get_region_detail(db: Session, region_id: int) -> dict | None:
    region = (db.query(Region).options(
        joinedload(Region.constituencies).joinedload(
            Constituency.results)).filter(Region.id == region_id).first())
    if not region:
        return None

    constituencies = []
    pcon24_codes = []
    for c in sorted(region.constituencies, key=lambda x: x.name):
        if c.pcon24_code:
            pcon24_codes.append(c.pcon24_code)

        # Determine winning party
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

        constituencies.append({
            "id": c.id,
            "name": c.name,
            "pcon24_code": c.pcon24_code,
            "winning_party_code": winner_code,
        })

    return {
        "id": region.id,
        "name": region.name,
        "pcon24_codes": pcon24_codes,
        "constituencies": constituencies,
    }
