"""Tests for the POST /api/upload/stream SSE endpoint."""

import io
import json

from app.models.constituency import Constituency


def _seed(db_session, names):
    for name in names:
        db_session.add(Constituency(name=name))
    db_session.commit()


def _parse_sse_events(response_text: str) -> list[dict]:
    """Parse SSE-formatted text into a list of event dicts."""
    events = []
    for block in response_text.split("\n\n"):
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


class TestUploadStreamEndpoint:

    def test_returns_event_stream_content_type(self, client, db_session):
        _seed(db_session, ["Bedford"])
        content = b"Bedford,100,C"
        resp = client.post(
            "/api/upload/stream",
            files={"file": ("test.txt", io.BytesIO(content), "text/plain")})
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]

    def test_emits_created_progress_complete(self, client, db_session):
        _seed(db_session, ["Bedford"])
        content = b"Bedford,100,C"
        resp = client.post(
            "/api/upload/stream",
            files={"file": ("test.txt", io.BytesIO(content), "text/plain")})
        events = _parse_sse_events(resp.text)
        event_types = [e["event"] for e in events]
        assert event_types[0] == "created"
        assert "progress" in event_types
        assert event_types[-1] == "complete"

    def test_created_event_has_upload_id(self, client, db_session):
        _seed(db_session, ["Bedford"])
        content = b"Bedford,100,C"
        resp = client.post(
            "/api/upload/stream",
            files={"file": ("test.txt", io.BytesIO(content), "text/plain")})
        events = _parse_sse_events(resp.text)
        created = events[0]
        assert "upload_id" in created
        assert isinstance(created["upload_id"], int)

    def test_complete_event_has_response_fields(self, client, db_session):
        _seed(db_session, ["Bedford"])
        content = b"Bedford,100,C,200,L"
        resp = client.post(
            "/api/upload/stream",
            files={"file": ("test.txt", io.BytesIO(content), "text/plain")})
        events = _parse_sse_events(resp.text)
        complete = events[-1]
        assert complete["status"] == "completed"
        assert complete["processed_lines"] == 1
        assert complete["error_lines"] == 0

    def test_empty_file_returns_400(self, client):
        resp = client.post(
            "/api/upload/stream",
            files={"file": ("test.txt", io.BytesIO(b""), "text/plain")})
        assert resp.status_code == 400

    def test_whitespace_only_file_returns_400(self, client):
        resp = client.post(
            "/api/upload/stream",
            files={"file": ("test.txt", io.BytesIO(b"   \n  "), "text/plain")})
        assert resp.status_code == 400

    def test_no_filename_returns_error(self, client):
        resp = client.post(
            "/api/upload/stream",
            files={"file": ("", io.BytesIO(b"data"), "text/plain")})
        assert resp.status_code in (400, 422)

    def test_multiple_lines(self, client, db_session):
        _seed(db_session, ["Bedford", "Oxford East"])
        content = b"Bedford,100,C\nOxford East,200,L"
        resp = client.post(
            "/api/upload/stream",
            files={"file": ("test.txt", io.BytesIO(content), "text/plain")})
        events = _parse_sse_events(resp.text)
        complete = events[-1]
        assert complete["processed_lines"] == 2
