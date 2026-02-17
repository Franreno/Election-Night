"""Tests for DELETE /api/uploads/{id}/stream SSE endpoint."""

import json

from app.models.constituency import Constituency
from app.models.result import Result
from app.models.result_history import ResultHistory
from app.models.upload_log import UploadLog


def _parse_sse_events(text: str) -> list[dict]:
    """Parse SSE text into a list of event dicts."""
    events = []
    for block in text.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        data_line = None
        for line in block.split("\n"):
            if line.startswith("data: "):
                data_line = line[6:]
        if data_line:
            events.append(json.loads(data_line))
    return events


def _create_upload(db, *, filename="test.txt", status="completed"):
    upload = UploadLog(
        filename=filename,
        status=status,
        total_lines=10,
        processed_lines=10,
        error_lines=0,
        errors=[],
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)
    return upload


def _seed_with_results(db, upload, name="TestPlace", party="L", votes=100):
    c = db.query(Constituency).filter_by(name=name).first()
    if c is None:
        c = Constituency(name=name)
        db.add(c)
        db.flush()
    r = Result(constituency_id=c.id,
               party_code=party,
               votes=votes,
               upload_id=upload.id)
    db.add(r)
    db.flush()
    db.add(ResultHistory(result_id=r.id, upload_id=upload.id, votes=votes))
    db.commit()
    return r


class TestDeleteStream:
    """DELETE /api/uploads/{id}/stream"""

    def test_returns_event_stream_content_type(self, client, db_session):
        upload = _create_upload(db_session)
        resp = client.delete(f"/api/uploads/{upload.id}/stream")
        assert resp.headers["content-type"].startswith("text/event-stream")

    def test_emits_started_and_complete(self, client, db_session):
        upload = _create_upload(db_session)
        _seed_with_results(db_session, upload)
        resp = client.delete(f"/api/uploads/{upload.id}/stream")
        events = _parse_sse_events(resp.text)
        event_types = [e["event"] for e in events]
        assert "started" in event_types
        assert "complete" in event_types

    def test_started_has_upload_id(self, client, db_session):
        upload = _create_upload(db_session)
        resp = client.delete(f"/api/uploads/{upload.id}/stream")
        events = _parse_sse_events(resp.text)
        started = events[0]
        assert started["upload_id"] == upload.id

    def test_complete_has_rolled_back(self, client, db_session):
        upload = _create_upload(db_session)
        _seed_with_results(db_session, upload)
        resp = client.delete(f"/api/uploads/{upload.id}/stream")
        events = _parse_sse_events(resp.text)
        complete = [e for e in events if e["event"] == "complete"][0]
        assert "rolled_back" in complete
        assert complete["message"] == "Upload deleted"

    def test_missing_upload_returns_404(self, client):
        resp = client.delete("/api/uploads/99999/stream")
        assert resp.status_code == 404

    def test_already_deleted_returns_404(self, client, db_session):
        upload = _create_upload(db_session)
        # Delete once via non-streaming endpoint
        client.delete(f"/api/uploads/{upload.id}")
        # Try streaming delete
        resp = client.delete(f"/api/uploads/{upload.id}/stream")
        assert resp.status_code == 404

    def test_emits_progress_for_multiple_results(self, client, db_session):
        upload = _create_upload(db_session)
        _seed_with_results(db_session, upload, "PlaceA", "L", 100)
        _seed_with_results(db_session, upload, "PlaceB", "C", 200)
        resp = client.delete(f"/api/uploads/{upload.id}/stream")
        events = _parse_sse_events(resp.text)
        progress_events = [e for e in events if e["event"] == "progress"]
        assert len(progress_events) >= 1

    def test_complete_event_has_upload_id(self, client, db_session):
        upload = _create_upload(db_session)
        resp = client.delete(f"/api/uploads/{upload.id}/stream")
        events = _parse_sse_events(resp.text)
        complete = [e for e in events if e["event"] == "complete"][0]
        assert complete["upload_id"] == upload.id
