"""Unit tests for ingest_file_streaming() generator."""

from app.models.constituency import Constituency
from app.models.result import Result
from app.models.result_history import ResultHistory
from app.models.upload_log import UploadLog
from app.services.ingestion import ingest_file_streaming


def _seed_constituencies(db_session, names):
    for name in names:
        db_session.add(Constituency(name=name))
    db_session.commit()


class TestIngestFileStreaming:
    """Test the streaming generator yields correct SSE events."""

    def test_yields_created_event_first(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        events = list(
            ingest_file_streaming(db_session, "Bedford,100,C", "test.txt"))
        assert events[0]["event"] == "created"
        assert "upload_id" in events[0]
        assert events[0]["total_lines"] == 1

    def test_yields_progress_events(self, db_session):
        _seed_constituencies(db_session, ["Bedford", "Oxford East"])
        content = "Bedford,100,C\nOxford East,200,L"
        events = list(
            ingest_file_streaming(db_session,
                                  content,
                                  "test.txt",
                                  batch_size=1))
        progress_events = [e for e in events if e["event"] == "progress"]
        assert len(progress_events) == 2
        assert progress_events[0]["percentage"] == 50
        assert progress_events[1]["percentage"] == 100

    def test_yields_complete_event_last(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        events = list(
            ingest_file_streaming(db_session, "Bedford,100,C", "test.txt"))
        last = events[-1]
        assert last["event"] == "complete"
        assert last["status"] == "completed"
        assert last["processed_lines"] == 1
        assert last["error_lines"] == 0

    def test_complete_event_contains_upload_id(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        events = list(
            ingest_file_streaming(db_session, "Bedford,100,C", "test.txt"))
        created_id = events[0]["upload_id"]
        complete_event = events[-1]
        assert complete_event["upload_id"] == created_id

    def test_event_sequence_created_progress_complete(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        events = list(
            ingest_file_streaming(db_session,
                                  "Bedford,100,C",
                                  "test.txt",
                                  batch_size=1))
        event_types = [e["event"] for e in events]
        assert event_types == ["created", "progress", "complete"]

    def test_unmatched_constituency_still_advances_progress(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        content = "Bedford,100,C\nNonexistent,200,L"
        events = list(
            ingest_file_streaming(db_session,
                                  content,
                                  "test.txt",
                                  batch_size=1))
        progress_events = [e for e in events if e["event"] == "progress"]
        assert len(progress_events) == 2
        complete = events[-1]
        assert complete["processed_lines"] == 1
        assert complete["error_lines"] == 1

    def test_progress_batching(self, db_session):
        """With batch_size=2 and 3 lines, yields 2 progress events 
          (at 2 and 3)."""
        names = ["Bedford", "Oxford East", "Cambridge"]
        _seed_constituencies(db_session, names)
        content = "Bedford,100,C\nOxford East,200,L\nCambridge,300,LD"
        events = list(
            ingest_file_streaming(db_session,
                                  content,
                                  "test.txt",
                                  batch_size=2))
        progress_events = [e for e in events if e["event"] == "progress"]
        assert len(progress_events) == 2
        assert progress_events[0]["processed_count"] == 2
        assert progress_events[1]["processed_count"] == 3

    def test_final_upload_log_status_completed(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        list(ingest_file_streaming(db_session, "Bedford,100,C", "test.txt"))
        upload = db_session.query(UploadLog).first()
        assert upload.status == "completed"
        assert upload.completed_at is not None

    def test_results_persisted_to_db(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        list(
            ingest_file_streaming(db_session, "Bedford,100,C,200,L",
                                  "test.txt"))
        results = db_session.query(Result).all()
        assert len(results) == 2

    def test_history_entries_created(self, db_session):
        _seed_constituencies(db_session, ["Bedford"])
        events = list(
            ingest_file_streaming(db_session, "Bedford,100,C,200,L",
                                  "test.txt"))
        upload_id = events[0]["upload_id"]
        history = db_session.query(ResultHistory).filter_by(
            upload_id=upload_id).all()
        assert len(history) == 2

    def test_parse_errors_in_complete_event(self, db_session):
        content = "Bedford"  # Invalid line format
        events = list(ingest_file_streaming(db_session, content, "test.txt"))
        complete = events[-1]
        assert complete["event"] == "complete"
        assert complete["error_lines"] >= 1
        assert len(complete["errors"]) >= 1

    def test_empty_file(self, db_session):
        events = list(ingest_file_streaming(db_session, "", "empty.txt"))
        # No valid lines to parse, should still get created + complete
        event_types = [e["event"] for e in events]
        assert "created" in event_types
        assert "complete" in event_types
        complete = events[-1]
        assert complete["processed_lines"] == 0
