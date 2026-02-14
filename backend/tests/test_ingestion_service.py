"""Unit tests for ConstituencyMatcher and ingestion logic."""

from app.models.constituency import Constituency
from app.models.result import Result
from app.services.ingestion import ConstituencyMatcher, ingest_file


def _seed_constituencies(db_session, names):
    for name in names:
        db_session.add(Constituency(name=name))
    db_session.commit()


class TestConstituencyMatcher:
    """Test the 5-strategy matching approach."""

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

    def test_prefix_match(self, db_session):
        """Official name starts with uploaded name."""
        _seed_constituencies(db_session, ["Broadland and Fakenham"])
        matcher = ConstituencyMatcher(db_session)
        result = matcher.find("Broadland")
        assert result is not None
        assert result.name == "Broadland and Fakenham"

    def test_suffix_match(self, db_session):
        """Official name ends with uploaded name."""
        _seed_constituencies(db_session, ["Chester South and Eddisbury"])
        matcher = ConstituencyMatcher(db_session)
        result = matcher.find("Eddisbury")
        assert result is not None
        assert result.name == "Chester South and Eddisbury"

    def test_shire_variant_match(self, db_session):
        """Official name starts with uploaded name + 'shire'."""
        _seed_constituencies(db_session, ["Monmouthshire"])
        matcher = ConstituencyMatcher(db_session)
        result = matcher.find("Monmouth")
        assert result is not None
        assert result.name == "Monmouthshire"

    def test_comma_stripping(self, db_session):
        """Commas in uploaded names are stripped for fuzzy matching."""
        _seed_constituencies(db_session, ["Birmingham Hall Green and Moseley"])
        matcher = ConstituencyMatcher(db_session)
        result = matcher.find("Birmingham, Hall Green")
        assert result is not None
        assert result.name == "Birmingham Hall Green and Moseley"

    def test_no_match_returns_none(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        matcher = ConstituencyMatcher(db_session)
        result = matcher.find("Nonexistent Place")
        assert result is None

    def test_ambiguous_prefix_match_rejected(self, db_session):
        """Multiple prefix matches should return None."""
        _seed_constituencies(db_session, [
            "Sherwood Forest",
            "Sherwood Park",
        ])
        matcher = ConstituencyMatcher(db_session)
        result = matcher.find("Sherwood")
        assert result is None

    def test_ambiguous_suffix_match_rejected(self, db_session):
        """Multiple suffix matches should return None."""
        _seed_constituencies(db_session, [
            "North Workington",
            "South Workington",
        ])
        matcher = ConstituencyMatcher(db_session)
        result = matcher.find("Workington")
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
