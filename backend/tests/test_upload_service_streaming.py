"""Unit tests for soft_delete_upload_streaming() generator."""

from app.models.constituency import Constituency
from app.models.result import Result
from app.models.result_history import ResultHistory
from app.models.upload_log import UploadLog
from app.services.upload_service import soft_delete_upload_streaming


def _create_upload(db,
                   *,
                   filename="test.txt",
                   status="completed",
                   total_lines=10,
                   processed_lines=10,
                   error_lines=0):
    upload = UploadLog(
        filename=filename,
        status=status,
        total_lines=total_lines,
        processed_lines=processed_lines,
        error_lines=error_lines,
        errors=[],
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)
    return upload


def _seed_with_results(db,
                       upload,
                       constituency_name="TestPlace",
                       party_code="L",
                       votes=100):
    """Create constituency + result + history linked to an upload."""
    c = db.query(Constituency).filter_by(name=constituency_name).first()
    if c is None:
        c = Constituency(name=constituency_name)
        db.add(c)
        db.flush()
    result = Result(
        constituency_id=c.id,
        party_code=party_code,
        votes=votes,
        upload_id=upload.id,
    )
    db.add(result)
    db.flush()
    db.add(
        ResultHistory(
            result_id=result.id,
            upload_id=upload.id,
            votes=votes,
        ))
    db.commit()
    return result


class TestSoftDeleteUploadStreaming:
    """Test the streaming delete generator yields correct SSE events."""

    def test_yields_started_event_first(self, db_session):
        upload = _create_upload(db_session)
        _seed_with_results(db_session, upload)
        events = list(soft_delete_upload_streaming(db_session, upload.id))
        assert events[0]["event"] == "started"
        assert events[0]["upload_id"] == upload.id
        assert "total_affected" in events[0]

    def test_yields_complete_event_last(self, db_session):
        upload = _create_upload(db_session)
        _seed_with_results(db_session, upload)
        events = list(soft_delete_upload_streaming(db_session, upload.id))
        last = events[-1]
        assert last["event"] == "complete"
        assert last["upload_id"] == upload.id
        assert "rolled_back" in last

    def test_event_sequence_started_progress_complete(self, db_session):
        upload = _create_upload(db_session)
        _seed_with_results(db_session, upload, "PlaceA", "L", 100)
        _seed_with_results(db_session, upload, "PlaceB", "C", 200)
        events = list(
            soft_delete_upload_streaming(db_session, upload.id, batch_size=1))
        event_types = [e["event"] for e in events]
        assert event_types == ["started", "progress", "progress", "complete"]

    def test_yields_progress_with_percentage(self, db_session):
        upload = _create_upload(db_session)
        _seed_with_results(db_session, upload, "PlaceA", "L", 100)
        _seed_with_results(db_session, upload, "PlaceB", "C", 200)
        events = list(
            soft_delete_upload_streaming(db_session, upload.id, batch_size=1))
        progress_events = [e for e in events if e["event"] == "progress"]
        assert len(progress_events) == 2
        assert progress_events[0]["percentage"] == 50
        assert progress_events[1]["percentage"] == 100

    def test_progress_batching(self, db_session):
        """With batch_size=2 and 3 affected results, yields 2 progress
        events (at 2 and 3)."""
        upload = _create_upload(db_session)
        _seed_with_results(db_session, upload, "PlaceA", "L", 100)
        _seed_with_results(db_session, upload, "PlaceB", "C", 200)
        _seed_with_results(db_session, upload, "PlaceC", "LD", 300)
        events = list(
            soft_delete_upload_streaming(db_session, upload.id, batch_size=2))
        progress_events = [e for e in events if e["event"] == "progress"]
        assert len(progress_events) == 2
        assert progress_events[0]["processed"] == 2
        assert progress_events[1]["processed"] == 3

    def test_zero_affected_results(self, db_session):
        """Upload with no results still yields started + complete."""
        upload = _create_upload(db_session)
        events = list(soft_delete_upload_streaming(db_session, upload.id))
        event_types = [e["event"] for e in events]
        assert event_types == ["started", "complete"]
        assert events[0]["total_affected"] == 0
        assert events[-1]["rolled_back"] == 0

    def test_returns_none_for_missing_upload(self, db_session):
        """Non-existent upload returns None (not a generator)."""
        result = soft_delete_upload_streaming(db_session, 99999)
        assert result is None

    def test_sets_deleted_at(self, db_session):
        upload = _create_upload(db_session)
        list(soft_delete_upload_streaming(db_session, upload.id))
        db_session.refresh(upload)
        assert upload.deleted_at is not None

    def test_results_rolled_back(self, db_session):
        """Result with no prior history is deleted after streaming delete."""
        upload = _create_upload(db_session)
        result = _seed_with_results(db_session, upload)
        result_id = result.id
        list(soft_delete_upload_streaming(db_session, upload.id))
        remaining = db_session.query(Result).filter_by(id=result_id).first()
        assert remaining is None

    def test_history_cleaned_up(self, db_session):
        upload = _create_upload(db_session)
        _seed_with_results(db_session, upload)
        list(soft_delete_upload_streaming(db_session, upload.id))
        history = db_session.query(ResultHistory).filter_by(
            upload_id=upload.id).all()
        assert len(history) == 0

    def test_rollback_to_previous_upload(self, db_session):
        """With two uploads, deleting the second restores first's values."""
        upload1 = _create_upload(db_session, filename="first.txt")
        c = Constituency(name="RollbackPlace")
        db_session.add(c)
        db_session.flush()
        r = Result(constituency_id=c.id,
                   party_code="L",
                   votes=100,
                   upload_id=upload1.id)
        db_session.add(r)
        db_session.flush()
        db_session.add(
            ResultHistory(result_id=r.id, upload_id=upload1.id, votes=100))
        db_session.commit()

        # Second upload updates the result
        upload2 = _create_upload(db_session, filename="second.txt")
        r.votes = 200
        r.upload_id = upload2.id
        db_session.add(
            ResultHistory(result_id=r.id, upload_id=upload2.id, votes=200))
        db_session.commit()

        # Delete upload2 via streaming
        list(soft_delete_upload_streaming(db_session, upload2.id))
        db_session.expire_all()
        result = db_session.query(Result).filter_by(constituency_id=c.id,
                                                    party_code="L").first()
        assert result is not None
        assert result.votes == 100
        assert result.upload_id == upload1.id
