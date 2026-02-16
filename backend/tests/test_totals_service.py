"""Unit tests for totals_service module."""

from app.models.constituency import Constituency
from app.models.result import Result
from app.models.upload_log import UploadLog
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


class TestTotalsSoftDeleteFiltering:
    """Totals should exclude results from soft-deleted uploads."""

    def test_votes_exclude_soft_deleted(self, db_session):
        from datetime import datetime, timezone  # noqa: PLC0415

        deleted_upload = UploadLog(
            filename="deleted.txt",
            status="completed",
            total_lines=1,
            processed_lines=1,
            error_lines=0,
            deleted_at=datetime.now(timezone.utc),
        )
        active_upload = UploadLog(
            filename="active.txt",
            status="completed",
            total_lines=1,
            processed_lines=1,
            error_lines=0,
        )
        db_session.add_all([deleted_upload, active_upload])
        db_session.flush()

        c = Constituency(name="TestPlace")
        db_session.add(c)
        db_session.flush()

        db_session.add_all([
            Result(constituency_id=c.id,
                   party_code="C",
                   votes=9000,
                   upload_id=deleted_upload.id),
            Result(constituency_id=c.id,
                   party_code="L",
                   votes=3000,
                   upload_id=active_upload.id),
        ])
        db_session.commit()

        result = get_total_results(db_session)
        # Only the active upload's votes should count
        assert result["total_votes"] == 3000
        parties = {p["party_code"]: p for p in result["parties"]}
        assert "C" not in parties
        assert parties["L"]["total_votes"] == 3000

    def test_seats_exclude_soft_deleted(self, db_session):
        from datetime import datetime, timezone  # noqa: PLC0415

        deleted_upload = UploadLog(
            filename="deleted.txt",
            status="completed",
            total_lines=1,
            processed_lines=1,
            error_lines=0,
            deleted_at=datetime.now(timezone.utc),
        )
        db_session.add(deleted_upload)
        db_session.flush()

        c = Constituency(name="SeatTest")
        db_session.add(c)
        db_session.flush()

        # C has most votes but from deleted upload — should NOT get a seat
        db_session.add_all([
            Result(constituency_id=c.id,
                   party_code="C",
                   votes=10000,
                   upload_id=deleted_upload.id),
            Result(constituency_id=c.id, party_code="L", votes=5000),
        ])
        db_session.commit()

        result = get_total_results(db_session)
        parties = {p["party_code"]: p for p in result["parties"]}
        # L should win the seat since C's results are from a deleted upload
        assert parties["L"]["seats"] == 1
        assert parties.get("C", {}).get("seats", 0) == 0

    def test_all_results_deleted_shows_zero(self, db_session):
        from datetime import datetime, timezone  # noqa: PLC0415

        deleted_upload = UploadLog(
            filename="deleted.txt",
            status="completed",
            total_lines=1,
            processed_lines=1,
            error_lines=0,
            deleted_at=datetime.now(timezone.utc),
        )
        db_session.add(deleted_upload)
        db_session.flush()

        c = Constituency(name="AllGone")
        db_session.add(c)
        db_session.flush()

        db_session.add(
            Result(constituency_id=c.id,
                   party_code="C",
                   votes=8000,
                   upload_id=deleted_upload.id))
        db_session.commit()

        result = get_total_results(db_session)
        assert result["total_votes"] == 0
        assert result["parties"] == []

    def test_results_without_upload_included(self, db_session):
        """Legacy results (no upload_id) should always be included."""
        c = Constituency(name="Legacy")
        db_session.add(c)
        db_session.flush()

        db_session.add(
            Result(constituency_id=c.id,
                   party_code="LD",
                   votes=4000,
                   upload_id=None))
        db_session.commit()

        result = get_total_results(db_session)
        assert result["total_votes"] == 4000
        parties = {p["party_code"]: p for p in result["parties"]}
        assert parties["LD"]["total_votes"] == 4000
        assert parties["LD"]["seats"] == 1
