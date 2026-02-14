"""Unit tests for totals_service module."""

from app.models.constituency import Constituency
from app.models.result import Result
from app.services.totals_service import get_total_results


def _seed_multi(db_session):
    """Seed multiple constituencies with results for totals testing."""
    c1 = Constituency(name="Bedford")
    c2 = Constituency(name="Sheffield Hallam")
    c3 = Constituency(name="Bristol West")
    db_session.add_all([c1, c2, c3])
    db_session.flush()

    db_session.add_all([
        # Bedford: C wins
        Result(constituency_id=c1.id, party_code="C", votes=6000),
        Result(constituency_id=c1.id, party_code="L", votes=5000),
        # Sheffield Hallam: L wins
        Result(constituency_id=c2.id, party_code="C", votes=3000),
        Result(constituency_id=c2.id, party_code="L", votes=8000),
        # Bristol West: G wins
        Result(constituency_id=c3.id, party_code="G", votes=7000),
        Result(constituency_id=c3.id, party_code="L", votes=4000),
    ])
    db_session.commit()
    return c1, c2, c3


class TestGetTotalResults:

    def test_total_constituencies(self, db_session):
        _seed_multi(db_session)
        result = get_total_results(db_session)
        assert result["total_constituencies"] == 3

    def test_total_votes(self, db_session):
        _seed_multi(db_session)
        result = get_total_results(db_session)
        assert result["total_votes"] == 6000 + 5000 + 3000 + 8000 + 7000 + 4000

    def test_party_vote_totals(self, db_session):
        _seed_multi(db_session)
        result = get_total_results(db_session)
        parties = {p["party_code"]: p for p in result["parties"]}
        assert parties["C"]["total_votes"] == 9000  # 6000 + 3000
        assert parties["L"]["total_votes"] == 17000  # 5000 + 8000 + 4000
        assert parties["G"]["total_votes"] == 7000

    def test_seat_counts(self, db_session):
        _seed_multi(db_session)
        result = get_total_results(db_session)
        parties = {p["party_code"]: p for p in result["parties"]}
        assert parties["C"]["seats"] == 1  # Won Bedford
        assert parties["L"]["seats"] == 1  # Won Sheffield Hallam
        assert parties["G"]["seats"] == 1  # Won Bristol West

    def test_tied_constituency_awards_no_seat(self, db_session):
        c = Constituency(name="Tied Place")
        db_session.add(c)
        db_session.flush()
        db_session.add_all([
            Result(constituency_id=c.id, party_code="C", votes=5000),
            Result(constituency_id=c.id, party_code="L", votes=5000),
        ])
        db_session.commit()

        result = get_total_results(db_session)
        parties = {p["party_code"]: p for p in result["parties"]}
        assert parties["C"]["seats"] == 0
        assert parties["L"]["seats"] == 0

    def test_empty_database(self, db_session):
        result = get_total_results(db_session)
        assert result["total_constituencies"] == 0
        assert result["total_votes"] == 0
        assert result["parties"] == []

    def test_parties_sorted_by_seats_then_votes(self, db_session):
        _seed_multi(db_session)
        result = get_total_results(db_session)
        # Should be sorted by (-seats, -total_votes)
        parties = result["parties"]
        for i in range(len(parties) - 1):
            current = (-parties[i]["seats"], -parties[i]["total_votes"])
            next_p = (-parties[i + 1]["seats"], -parties[i + 1]["total_votes"])
            assert current <= next_p

    def test_party_name_mapping(self, db_session):
        _seed_multi(db_session)
        result = get_total_results(db_session)
        parties = {p["party_code"]: p for p in result["parties"]}
        assert parties["C"]["party_name"] == "Conservative Party"
        assert parties["L"]["party_name"] == "Labour Party"
        assert parties["G"]["party_name"] == "Green Party"
