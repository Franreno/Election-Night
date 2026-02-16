"""Tests for upload service: soft delete, filters, and statistics."""
import io

import pytest

from app.models.constituency import Constituency
from app.models.result import Result
from app.models.result_history import ResultHistory
from app.models.upload_log import UploadLog

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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


# ===========================================================================
# Soft Delete via API
# ===========================================================================


class TestSoftDeleteEndpoint:
    """DELETE /api/uploads/{upload_id}"""

    def test_soft_delete_marks_deleted_at(self, client, db_session):
        upload = _create_upload(db_session)
        resp = client.delete(f"/api/uploads/{upload.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Upload deleted"
        # Verify in DB
        db_session.refresh(upload)
        assert upload.deleted_at is not None

    def test_soft_delete_nonexistent_upload_returns_404(self, client):
        resp = client.delete("/api/uploads/99999")
        assert resp.status_code == 404

    def test_soft_delete_already_deleted_returns_404(self, client, db_session):
        upload = _create_upload(db_session)
        # Delete once
        resp = client.delete(f"/api/uploads/{upload.id}")
        assert resp.status_code == 200
        # Delete again
        resp = client.delete(f"/api/uploads/{upload.id}")
        assert resp.status_code == 404

    def test_deleted_uploads_excluded_from_list(self, client, db_session):
        _ = _create_upload(db_session, filename="keep.txt")
        u2 = _create_upload(db_session, filename="delete_me.txt")
        # Delete u2
        client.delete(f"/api/uploads/{u2.id}")
        # List should only show u1
        resp = client.get("/api/uploads")
        assert resp.status_code == 200
        uploads = resp.json()["uploads"]
        filenames = [u["filename"] for u in uploads]
        assert "keep.txt" in filenames
        assert "delete_me.txt" not in filenames

    def test_soft_delete_removes_result_with_no_prior_history(
            self, client, db_session):
        """Result with no prior upload history is deleted on soft-delete."""
        c = Constituency(name="TestConstituency")
        db_session.add(c)
        db_session.flush()

        upload = _create_upload(db_session)
        result = Result(
            constituency_id=c.id,
            party_code="L",
            votes=100,
            upload_id=upload.id,
        )
        db_session.add(result)
        db_session.flush()
        # Record history (as ingestion would)
        db_session.add(
            ResultHistory(result_id=result.id,
                          upload_id=upload.id,
                          votes=100))
        db_session.commit()

        # Delete upload
        client.delete(f"/api/uploads/{upload.id}")

        # Result should be deleted (no prior upload to roll back to)
        remaining = db_session.query(Result).filter(
            Result.constituency_id == c.id).all()
        assert len(remaining) == 0


# ===========================================================================
# Soft Delete Rollback
# ===========================================================================


class TestSoftDeleteRollback:
    """Deleting an upload should roll back results to prior upload values."""

    def _seed_and_upload(self, client, db_session, constituency_name, content,
                         filename):
        """Helper: ensure constituency exists and upload content."""
        from tests.conftest import seed_constituencies  # noqa: PLC0415
        # Only seed if not already present
        existing = db_session.query(Constituency).filter_by(
            name=constituency_name).first()
        if existing is None:
            seed_constituencies(db_session, [constituency_name])
        resp = client.post(
            "/api/upload",
            files={"file": (filename, io.BytesIO(content), "text/plain")},
        )
        assert resp.status_code == 201
        return resp.json()["upload_id"]

    def test_delete_rolls_back_to_previous_upload(self, client, db_session):
        """Upload 1 sets 100, upload 2 sets 200. Delete upload 2 → 100."""
        uid1 = self._seed_and_upload(client, db_session, "TestPlace",
                                     b"TestPlace,100,L", "first.txt")
        uid2 = self._seed_and_upload(client, db_session, "TestPlace",
                                     b"TestPlace,200,L", "second.txt")

        # Verify current state: 200 votes, upload_id = uid2
        result = db_session.query(Result).filter_by(party_code="L").first()
        assert result.votes == 200
        assert result.upload_id == uid2

        # Delete upload 2
        resp = client.delete(f"/api/uploads/{uid2}")
        assert resp.status_code == 200

        # Result should roll back to upload 1's values
        db_session.expire_all()
        result = db_session.query(Result).filter_by(party_code="L").first()
        assert result is not None
        assert result.votes == 100
        assert result.upload_id == uid1

    def test_delete_removes_result_with_no_prior_upload(self, client,
                                                        db_session):
        """Upload 1 creates a result. Delete upload 1 → result deleted."""
        uid1 = self._seed_and_upload(client, db_session, "TestPlace",
                                     b"TestPlace,500,C", "only.txt")

        # Result exists
        result = db_session.query(Result).filter_by(party_code="C").first()
        assert result is not None

        # Delete the only upload
        client.delete(f"/api/uploads/{uid1}")

        # Result should be gone
        db_session.expire_all()
        result = db_session.query(Result).filter_by(party_code="C").first()
        assert result is None

    def test_delete_only_affects_results_from_that_upload(self, client,
                                                          db_session):
        """Upload 1 sets A. Upload 2 sets B. Delete upload 2 → A unchanged."""
        uid1 = self._seed_and_upload(client, db_session, "PlaceA",
                                     b"PlaceA,100,L", "first.txt")
        uid2 = self._seed_and_upload(client, db_session, "PlaceB",
                                     b"PlaceB,200,C", "second.txt")

        # Delete upload 2
        client.delete(f"/api/uploads/{uid2}")

        db_session.expire_all()
        # PlaceA result unchanged
        c_a = db_session.query(Constituency).filter_by(
            name="PlaceA").first()
        result_a = db_session.query(Result).filter_by(
            constituency_id=c_a.id).first()
        assert result_a is not None
        assert result_a.votes == 100
        assert result_a.upload_id == uid1

        # PlaceB result deleted (no prior history)
        c_b = db_session.query(Constituency).filter_by(
            name="PlaceB").first()
        result_b = db_session.query(Result).filter_by(
            constituency_id=c_b.id).first()
        assert result_b is None

    def test_chain_rollback(self, client, db_session):
        """Upload 1→100, Upload 2→200, Upload 3→300.
        Delete 3→200, delete 2→100."""
        uid1 = self._seed_and_upload(client, db_session, "TestPlace",
                                     b"TestPlace,100,L", "first.txt")
        uid2 = self._seed_and_upload(client, db_session, "TestPlace",
                                     b"TestPlace,200,L", "second.txt")
        uid3 = self._seed_and_upload(client, db_session, "TestPlace",
                                     b"TestPlace,300,L", "third.txt")

        # Delete upload 3 → should roll back to 200
        client.delete(f"/api/uploads/{uid3}")
        db_session.expire_all()
        result = db_session.query(Result).filter_by(party_code="L").first()
        assert result.votes == 200
        assert result.upload_id == uid2

        # Delete upload 2 → should roll back to 100
        client.delete(f"/api/uploads/{uid2}")
        db_session.expire_all()
        result = db_session.query(Result).filter_by(party_code="L").first()
        assert result.votes == 100
        assert result.upload_id == uid1

    def test_history_cleaned_up_after_delete(self, client, db_session):
        """History rows for the deleted upload are removed."""
        uid1 = self._seed_and_upload(client, db_session, "TestPlace",
                                     b"TestPlace,100,L", "first.txt")
        uid2 = self._seed_and_upload(client, db_session, "TestPlace",
                                     b"TestPlace,200,L", "second.txt")

        # Delete upload 2
        client.delete(f"/api/uploads/{uid2}")

        # History for upload 2 should be gone
        history_for_u2 = db_session.query(ResultHistory).filter_by(
            upload_id=uid2).all()
        assert len(history_for_u2) == 0

        # History for upload 1 should remain
        history_for_u1 = db_session.query(ResultHistory).filter_by(
            upload_id=uid1).all()
        assert len(history_for_u1) >= 1


# ===========================================================================
# Upload Filters via API
# ===========================================================================


class TestUploadFilters:
    """GET /api/uploads with status and search filters."""

    def test_filter_by_status_completed(self, client, db_session):
        _create_upload(db_session, filename="a.txt", status="completed")
        _create_upload(db_session, filename="b.txt", status="failed")
        resp = client.get("/api/uploads?status=completed")
        assert resp.status_code == 200
        uploads = resp.json()["uploads"]
        assert all(u["status"] == "completed" for u in uploads)
        assert len(uploads) == 1

    def test_filter_by_status_failed(self, client, db_session):
        _create_upload(db_session, filename="a.txt", status="completed")
        _create_upload(db_session, filename="b.txt", status="failed")
        resp = client.get("/api/uploads?status=failed")
        uploads = resp.json()["uploads"]
        assert all(u["status"] == "failed" for u in uploads)
        assert len(uploads) == 1

    def test_filter_by_filename_search(self, client, db_session):
        _create_upload(db_session, filename="election-2024.txt")
        _create_upload(db_session, filename="other-data.txt")
        resp = client.get("/api/uploads?search=election")
        uploads = resp.json()["uploads"]
        assert len(uploads) == 1
        assert uploads[0]["filename"] == "election-2024.txt"

    def test_filter_by_filename_case_insensitive(self, client, db_session):
        _create_upload(db_session, filename="Election-Results.txt")
        resp = client.get("/api/uploads?search=election")
        uploads = resp.json()["uploads"]
        assert len(uploads) == 1

    def test_combined_filters(self, client, db_session):
        _create_upload(db_session, filename="election.txt", status="completed")
        _create_upload(db_session, filename="election.txt", status="failed")
        _create_upload(db_session, filename="other.txt", status="completed")
        resp = client.get("/api/uploads?status=completed&search=election")
        uploads = resp.json()["uploads"]
        assert len(uploads) == 1
        assert uploads[0]["filename"] == "election.txt"
        assert uploads[0]["status"] == "completed"


# ===========================================================================
# Upload Statistics via API
# ===========================================================================


class TestUploadStats:
    """GET /api/uploads/stats"""

    def test_stats_empty_db(self, client):
        resp = client.get("/api/uploads/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_uploads"] == 0
        assert data["completed"] == 0
        assert data["failed"] == 0
        assert data["success_rate"] == 0.0
        assert data["total_lines_processed"] == 0

    def test_stats_with_data(self, client, db_session):
        _create_upload(db_session, status="completed", processed_lines=50)
        _create_upload(db_session, status="completed", processed_lines=30)
        _create_upload(db_session, status="failed", processed_lines=0)
        resp = client.get("/api/uploads/stats")
        data = resp.json()
        assert data["total_uploads"] == 3
        assert data["completed"] == 2
        assert data["failed"] == 1
        assert data["success_rate"] == pytest.approx(66.67, abs=0.01)
        assert data["total_lines_processed"] == 80

    def test_stats_excludes_deleted(self, client, db_session):
        u1 = _create_upload(db_session, status="completed", processed_lines=50)
        _create_upload(db_session, status="completed", processed_lines=30)
        # Delete u1
        client.delete(f"/api/uploads/{u1.id}")
        resp = client.get("/api/uploads/stats")
        data = resp.json()
        assert data["total_uploads"] == 1
        assert data["completed"] == 1
        assert data["total_lines_processed"] == 30


# ===========================================================================
# File Size Validation via API
# ===========================================================================


class TestFileSizeValidation:
    """POST /api/upload with file size limits."""

    def test_upload_too_large_returns_413(self, client):
        # Create a file slightly over 100MB
        large_content = b"x" * (100 * 1024 * 1024 + 1)
        resp = client.post(
            "/api/upload",
            files={
                "file": ("large.txt", io.BytesIO(large_content), "text/plain")
            },
        )
        assert resp.status_code == 413

    def test_upload_within_limit_accepted(self, client, db_session):
        from tests.conftest import seed_constituencies  # noqa: PLC0415
        seed_constituencies(db_session, ["TestPlace"])
        # Small valid file
        content = b"TestPlace,100,L"
        resp = client.post(
            "/api/upload",
            files={"file": ("small.txt", io.BytesIO(content), "text/plain")},
        )
        assert resp.status_code == 201


# ===========================================================================
# Upload ID Tracking on Results
# ===========================================================================


class TestUploadIdTracking:
    """Results should be linked to their source upload via upload_id."""

    def test_ingest_sets_upload_id_on_results(self, client, db_session):
        from tests.conftest import seed_constituencies  # noqa: PLC0415
        seed_constituencies(db_session, ["TestPlace"])
        content = b"TestPlace,100,L"
        resp = client.post(
            "/api/upload",
            files={"file": ("test.txt", io.BytesIO(content), "text/plain")},
        )
        assert resp.status_code == 201
        upload_id = resp.json()["upload_id"]
        # Check result has upload_id set
        result = db_session.query(Result).filter(
            Result.upload_id == upload_id).first()
        assert result is not None
        assert result.votes == 100
        assert result.party_code == "L"

    def test_upsert_updates_upload_id_to_latest(self, client, db_session):
        from tests.conftest import seed_constituencies  # noqa: PLC0415
        seed_constituencies(db_session, ["TestPlace"])
        # First upload
        content1 = b"TestPlace,100,L"
        resp1 = client.post(
            "/api/upload",
            files={"file": ("first.txt", io.BytesIO(content1), "text/plain")},
        )
        upload_id_1 = resp1.json()["upload_id"]
        # Second upload with updated votes
        content2 = b"TestPlace,200,L"
        resp2 = client.post(
            "/api/upload",
            files={"file": ("second.txt", io.BytesIO(content2), "text/plain")},
        )
        upload_id_2 = resp2.json()["upload_id"]
        assert upload_id_1 != upload_id_2
        # Result should point to second upload
        result = db_session.query(Result).filter(
            Result.party_code == "L").first()
        assert result.upload_id == upload_id_2
        assert result.votes == 200
