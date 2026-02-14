"""Unit tests for constituency_service module."""


from app.models.constituency import Constituency
from app.models.region import Region
from app.models.result import Result
from app.services.constituency_service import (
    get_all_constituencies,
    get_all_constituencies_summary,
    get_constituency_by_id,
)


def _seed(db_session, with_region=False):
    """Seed test data and return the created objects."""
    region = None
    if with_region:
        region = Region(name="East of England", sort_order=1)
        db_session.add(region)
        db_session.flush()

    c1 = Constituency(name="Bedford", region_id=region.id if region else None)
    c2 = Constituency(name="Sheffield Hallam",
                      region_id=region.id if region else None)
    c3 = Constituency(name="Empty Constituency")
    db_session.add_all([c1, c2, c3])
    db_session.flush()

    db_session.add_all([
        Result(constituency_id=c1.id, party_code="C", votes=6000),
        Result(constituency_id=c1.id, party_code="L", votes=5000),
        Result(constituency_id=c2.id, party_code="L", votes=8000),
        Result(constituency_id=c2.id, party_code="LD", votes=4000),
    ])
    db_session.commit()
    return c1, c2, c3, region


class TestGetAllConstituencies:

    def test_returns_all_constituencies(self, db_session):
        _seed(db_session)
        result = get_all_constituencies(db_session)
        assert result["total"] == 3
        assert len(result["constituencies"]) == 3
        assert result["page"] == 1
        assert result["page_size"] == 50

    def test_search_filter(self, db_session):
        _seed(db_session)
        result = get_all_constituencies(db_session, search="bedford")
        assert result["total"] == 1
        assert result["constituencies"][0]["name"] == "Bedford"

    def test_search_case_insensitive(self, db_session):
        _seed(db_session)
        result = get_all_constituencies(db_session, search="BEDFORD")
        assert result["total"] == 1

    def test_pagination(self, db_session):
        _seed(db_session)
        result = get_all_constituencies(db_session, page=1, page_size=2)
        assert result["total"] == 3
        assert len(result["constituencies"]) == 2
        assert result["page"] == 1
        assert result["page_size"] == 2

    def test_pagination_page_2(self, db_session):
        _seed(db_session)
        result = get_all_constituencies(db_session, page=2, page_size=2)
        assert len(result["constituencies"]) == 1

    def test_sort_by_name_asc(self, db_session):
        _seed(db_session)
        result = get_all_constituencies(db_session,
                                        sort_by="name",
                                        sort_dir="asc")
        names = [c["name"] for c in result["constituencies"]]
        assert names == sorted(names)

    def test_sort_by_name_desc(self, db_session):
        _seed(db_session)
        result = get_all_constituencies(db_session,
                                        sort_by="name",
                                        sort_dir="desc")
        names = [c["name"] for c in result["constituencies"]]
        assert names == sorted(names, reverse=True)

    def test_sort_by_total_votes(self, db_session):
        _seed(db_session)
        result = get_all_constituencies(db_session,
                                        sort_by="total_votes",
                                        sort_dir="desc")
        votes = [c["total_votes"] for c in result["constituencies"]]
        assert votes == sorted(votes, reverse=True)

    def test_constituency_format(self, db_session):
        _seed(db_session, with_region=True)
        result = get_all_constituencies(db_session, search="Bedford")
        c = result["constituencies"][0]
        assert c["name"] == "Bedford"
        assert c["total_votes"] == 11000
        assert c["winning_party_code"] == "C"
        assert c["winning_party_name"] == "Conservative Party"
        assert c["region_name"] == "East of England"
        assert len(c["parties"]) == 2

    def test_empty_search_returns_all(self, db_session):
        _seed(db_session)
        result = get_all_constituencies(db_session, search="")
        assert result["total"] == 3

    def test_no_matches(self, db_session):
        _seed(db_session)
        result = get_all_constituencies(db_session, search="nonexistent")
        assert result["total"] == 0
        assert result["constituencies"] == []


class TestGetAllConstituenciesSummary:

    def test_returns_summary(self, db_session):
        _seed(db_session, with_region=True)
        result = get_all_constituencies_summary(db_session)
        assert result["total"] == 3
        assert len(result["constituencies"]) == 3

    def test_summary_format(self, db_session):
        _seed(db_session, with_region=True)
        result = get_all_constituencies_summary(db_session)
        bedford = next(c for c in result["constituencies"]
                       if c["name"] == "Bedford")
        assert bedford["winning_party_code"] == "C"
        assert bedford["region_name"] == "East of England"

    def test_tied_constituency_no_winner(self, db_session):
        """When two parties have equal votes, winner should be None."""
        c = Constituency(name="Tied Place")
        db_session.add(c)
        db_session.flush()
        db_session.add_all([
            Result(constituency_id=c.id, party_code="C", votes=5000),
            Result(constituency_id=c.id, party_code="L", votes=5000),
        ])
        db_session.commit()

        result = get_all_constituencies_summary(db_session)
        tied = next(c for c in result["constituencies"]
                    if c["name"] == "Tied Place")
        assert tied["winning_party_code"] is None

    def test_constituency_without_results(self, db_session):
        _seed(db_session)
        result = get_all_constituencies_summary(db_session)
        empty = next(c for c in result["constituencies"]
                     if c["name"] == "Empty Constituency")
        assert empty["winning_party_code"] is None


class TestGetConstituencyById:

    def test_returns_constituency(self, db_session):
        c1, _, _, _ = _seed(db_session)
        result = get_constituency_by_id(db_session, c1.id)
        assert result is not None
        assert result["name"] == "Bedford"
        assert result["total_votes"] == 11000

    def test_returns_none_for_invalid_id(self, db_session):
        _seed(db_session)
        result = get_constituency_by_id(db_session, 9999)
        assert result is None

    def test_parties_sorted_by_votes_desc(self, db_session):
        c1, _, _, _ = _seed(db_session)
        result = get_constituency_by_id(db_session, c1.id)
        votes = [p["votes"] for p in result["parties"]]
        assert votes == sorted(votes, reverse=True)

    def test_party_percentages(self, db_session):
        c1, _, _, _ = _seed(db_session)
        result = get_constituency_by_id(db_session, c1.id)
        total = sum(p["percentage"] for p in result["parties"])
        assert abs(total - 100.0) < 0.1
