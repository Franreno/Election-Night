"""Unit tests for ConstituencyMatcher and ingestion logic."""

from app.models.constituency import Constituency
from app.models.result import Result
from app.models.result_history import ResultHistory
from app.services.ingestion import ConstituencyMatcher, ingest_file


def _seed_constituencies(db_session, names):
    for name in names:
        db_session.add(Constituency(name=name))
    db_session.commit()


class TestConstituencyMatcher:
    """Test the matching approach: exact, case-insensitive, and normalized."""

    def test_exact_match(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        matcher = ConstituencyMatcher(db_session)
        result = matcher.find("Bedford")
        assert result is not None
        assert result.name == "Bedford"

    def test_case_insensitive_match(self, db_session):
        _seed_constituencies(db_session, ["City of Durham"])
        matcher = ConstituencyMatcher(db_session)
        result = matcher.find("City Of Durham")
        assert result is not None
        assert result.name == "City of Durham"

    def test_comma_stripping(self, db_session):
        """Commas in uploaded names are stripped for normalized matching."""
        _seed_constituencies(db_session, ["Birmingham, Hall Green"])
        matcher = ConstituencyMatcher(db_session)
        # Input without comma should match DB name with comma
        result = matcher.find("Birmingham Hall Green")
        assert result is not None
        assert result.name == "Birmingham, Hall Green"

    def test_comma_stripping_case_insensitive(self, db_session):
        """Comma stripping combined with case-insensitive matching."""
        _seed_constituencies(db_session, ["Birmingham, Hall Green"])
        matcher = ConstituencyMatcher(db_session)
        result = matcher.find("BIRMINGHAM, HALL GREEN")
        assert result is not None
        assert result.name == "Birmingham, Hall Green"

    def test_diacritic_normalization(self, db_session):
        """Diacritics in DB names are stripped for matching."""
        _seed_constituencies(db_session, ["Ynys Môn"])
        matcher = ConstituencyMatcher(db_session)
        # Input without diacritic should match DB name with diacritic
        result = matcher.find("Ynys Mon")
        assert result is not None
        assert result.name == "Ynys Môn"

    def test_diacritic_exact_match_preserved(self, db_session):
        """Input with diacritics still matches exactly."""
        _seed_constituencies(db_session, ["Ynys Môn"])
        matcher = ConstituencyMatcher(db_session)
        result = matcher.find("Ynys Môn")
        assert result is not None
        assert result.name == "Ynys Môn"

    def test_no_match_returns_none(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        matcher = ConstituencyMatcher(db_session)
        result = matcher.find("Nonexistent Place")
        assert result is None


class TestIngestFile:

    def test_basic_ingestion(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        content = "Bedford,6643,C,5276,L"
        upload = ingest_file(db_session, content, "test.txt")
        assert upload.status == "completed"
        assert upload.processed_lines == 1
        assert upload.error_lines == 0

        results = db_session.query(Result).all()
        assert len(results) == 2

    def test_unmatched_constituency_logged_as_error(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        content = "Nonexistent,100,C,200,L"
        upload = ingest_file(db_session, content, "test.txt")
        assert upload.status == "completed"
        assert upload.processed_lines == 0
        assert upload.error_lines == 1

    def test_upsert_updates_existing_results(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])

        # First upload
        ingest_file(db_session, "Bedford,1000,C,2000,L", "first.txt")
        c = db_session.query(Constituency).filter_by(name="Bedford").first()
        result_c = db_session.query(Result).filter_by(constituency_id=c.id,
                                                      party_code="C").first()
        assert result_c.votes == 1000

        # Second upload - should update
        ingest_file(db_session, "Bedford,5000,C,3000,L", "second.txt")
        db_session.refresh(result_c)
        assert result_c.votes == 5000

    def test_multiple_lines(self, db_session):
        _seed_constituencies(db_session, ["Bedford", "Sheffield Hallam"])
        content = "Bedford,6643,C,5276,L\nSheffield Hallam,8788,LD,4277,L"
        upload = ingest_file(db_session, content, "test.txt")
        assert upload.processed_lines == 2
        assert upload.error_lines == 0

    def test_parse_errors_tracked(self, db_session):
        content = "Bedford"  # Invalid line format
        upload = ingest_file(db_session, content, "test.txt")
        assert upload.error_lines >= 1
        assert len(upload.errors) >= 1

    def test_empty_file(self, db_session):
        upload = ingest_file(db_session, "", "empty.txt")
        assert upload.processed_lines == 0

    def test_upload_log_created(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        upload = ingest_file(db_session, "Bedford,100,C,200,L", "test.txt")
        assert upload.id is not None
        assert upload.filename == "test.txt"
        assert upload.total_lines == 1

    def test_ingest_creates_history_entry(self, db_session):
        """Each upserted result should have a corresponding history row."""
        _seed_constituencies(db_session, ["Bedford"])
        upload = ingest_file(db_session, "Bedford,100,C,200,L", "test.txt")
        history = db_session.query(ResultHistory).filter_by(
            upload_id=upload.id).all()
        assert len(history) == 2
        votes_set = {h.votes for h in history}
        assert votes_set == {100, 200}

    def test_upsert_creates_new_history_entry(self, db_session):
        """Two uploads touching the same result create two history rows."""
        _seed_constituencies(db_session, ["Bedford"])
        u1 = ingest_file(db_session, "Bedford,100,C", "first.txt")
        u2 = ingest_file(db_session, "Bedford,500,C", "second.txt")

        c = db_session.query(Constituency).filter_by(name="Bedford").first()
        result = db_session.query(Result).filter_by(
            constituency_id=c.id, party_code="C").first()

        history = db_session.query(ResultHistory).filter_by(
            result_id=result.id).order_by(ResultHistory.id).all()
        assert len(history) == 2
        assert history[0].upload_id == u1.id
        assert history[0].votes == 100
        assert history[1].upload_id == u2.id
        assert history[1].votes == 500
