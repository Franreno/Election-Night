from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.result import Result
from app.models.result_history import ResultHistory
from app.models.upload_log import UploadLog


def _rollback_results(db: Session, upload_id: int) -> None:
    """Roll back results affected by a deleted upload to their previous values.

    For each result that was last modified by the deleted upload, find the most
    recent history entry from a non-deleted upload and restore those values.
    If no prior history exists, delete the result entirely.
    """
    # Find all history entries for this upload to get affected result_ids
    affected_result_ids = [
        row[0] for row in db.query(ResultHistory.result_id).filter(
            ResultHistory.upload_id == upload_id).distinct().all()
    ]

    for result_id in affected_result_ids:
        # Only roll back if this result's current upload_id matches the
        # deleted upload (i.e., the deleted upload was the last to touch it)
        result = db.query(Result).filter(Result.id == result_id).first()
        if result is None or result.upload_id != upload_id:
            continue

        # Find the most recent history entry from a non-deleted upload
        prev_history = (db.query(ResultHistory).outerjoin(
            UploadLog, ResultHistory.upload_id == UploadLog.id).filter(
                ResultHistory.result_id == result_id,
                ResultHistory.upload_id != upload_id,
                # Accept entries with no upload or with non-deleted uploads
                (ResultHistory.upload_id.is_(None)
                 | UploadLog.deleted_at.is_(None)),
            ).order_by(ResultHistory.id.desc()).first())

        if prev_history is not None:
            result.votes = prev_history.votes
            result.upload_id = prev_history.upload_id
        else:
            db.delete(result)

    # Clean up history rows for the deleted upload
    db.query(ResultHistory).filter(
        ResultHistory.upload_id == upload_id).delete()


def soft_delete_upload(db: Session, upload_id: int) -> UploadLog | None:
    """Soft-delete an upload by setting deleted_at.

    Also rolls back any results that were last modified by this upload to
    their previous values from the result history. Returns None if not found.
    """
    upload = (db.query(UploadLog).filter(
        UploadLog.id == upload_id, UploadLog.deleted_at.is_(None)).first())
    if upload is None:
        return None
    upload.deleted_at = datetime.now(timezone.utc)
    _rollback_results(db, upload_id)
    db.commit()
    db.refresh(upload)
    return upload


def get_upload_stats(db: Session) -> dict:
    """Compute aggregate statistics for non-deleted uploads."""
    base = db.query(UploadLog).filter(UploadLog.deleted_at.is_(None))

    total = base.count()
    completed = base.filter(UploadLog.status == "completed").count()
    failed = base.filter(UploadLog.status == "failed").count()
    success_rate = round((completed / total) * 100, 2) if total > 0 else 0.0

    total_lines = (base.with_entities(
        func.coalesce(func.sum(UploadLog.processed_lines), 0)).scalar())

    return {
        "total_uploads": total,
        "completed": completed,
        "failed": failed,
        "success_rate": success_rate,
        "total_lines_processed": total_lines,
    }
