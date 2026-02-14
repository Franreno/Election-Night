"""Unit tests for geography_service module."""

from app.models.constituency import Constituency
from app.models.region import Region
from app.models.result import Result
from app.services.geography_service import get_all_regions, get_region_detail


def _seed_regions(db_session):
    """Seed regions with constituencies."""
    r1 = Region(name="London", sort_order=1)
    r2 = Region(name="East of England", sort_order=2)
    r3 = Region(name="Empty Region", sort_order=3)
    db_session.add_all([r1, r2, r3])
    db_session.flush()

    c1 = Constituency(name="Westminster", pcon24_code="E14001", region_id=r1.id)
    c2 = Constituency(name="Hackney", pcon24_code="E14002", region_id=r1.id)
    c3 = Constituency(name="Bedford", pcon24_code="E14003", region_id=r2.id)
    db_session.add_all([c1, c2, c3])
    db_session.flush()

    db_session.add_all([
        Result(constituency_id=c1.id, party_code="C", votes=8000),
        Result(constituency_id=c1.id, party_code="L", votes=5000),
        Result(constituency_id=c2.id, party_code="L", votes=9000),
        Result(constituency_id=c2.id, party_code="G", votes=3000),
        Result(constituency_id=c3.id, party_code="C", votes=6000),
    ])
    db_session.commit()
    return r1, r2, r3, c1, c2, c3


class TestGetAllRegions:
    def test_returns_all_regions(self, db_session):
        _seed_regions(db_session)
        result = get_all_regions(db_session)
        assert len(result["regions"]) == 3

    def test_ordered_by_sort_order(self, db_session):
        _seed_regions(db_session)
        result = get_all_regions(db_session)
        names = [r["name"] for r in result["regions"]]
        assert names == ["London", "East of England", "Empty Region"]

    def test_constituency_count(self, db_session):
        _seed_regions(db_session)
        result = get_all_regions(db_session)
        regions = {r["name"]: r for r in result["regions"]}
        assert regions["London"]["constituency_count"] == 2
        assert regions["East of England"]["constituency_count"] == 1
        assert regions["Empty Region"]["constituency_count"] == 0

    def test_region_format(self, db_session):
        _seed_regions(db_session)
        result = get_all_regions(db_session)
        region = result["regions"][0]
        assert "id" in region
        assert "name" in region
        assert "sort_order" in region
        assert "constituency_count" in region

    def test_empty_database(self, db_session):
        result = get_all_regions(db_session)
        assert result["regions"] == []


class TestGetRegionDetail:
    def test_returns_region_detail(self, db_session):
        r1, _, _, _, _, _ = _seed_regions(db_session)
        result = get_region_detail(db_session, r1.id)
        assert result is not None
        assert result["name"] == "London"
        assert len(result["constituencies"]) == 2

    def test_returns_pcon24_codes(self, db_session):
        r1, _, _, _, _, _ = _seed_regions(db_session)
        result = get_region_detail(db_session, r1.id)
        assert set(result["pcon24_codes"]) == {"E14001", "E14002"}

    def test_constituencies_sorted_by_name(self, db_session):
        r1, _, _, _, _, _ = _seed_regions(db_session)
        result = get_region_detail(db_session, r1.id)
        names = [c["name"] for c in result["constituencies"]]
        assert names == sorted(names)

    def test_winning_party_detection(self, db_session):
        r1, _, _, _, _, _ = _seed_regions(db_session)
        result = get_region_detail(db_session, r1.id)
        constituencies = {c["name"]: c for c in result["constituencies"]}
        assert constituencies["Westminster"]["winning_party_code"] == "C"
        assert constituencies["Hackney"]["winning_party_code"] == "L"

    def test_returns_none_for_invalid_id(self, db_session):
        _seed_regions(db_session)
        result = get_region_detail(db_session, 9999)
        assert result is None

    def test_empty_region(self, db_session):
        _, _, r3, _, _, _ = _seed_regions(db_session)
        result = get_region_detail(db_session, r3.id)
        assert result is not None
        assert result["constituencies"] == []
        assert result["pcon24_codes"] == []
