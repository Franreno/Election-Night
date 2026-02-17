from collections.abc import Generator
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.result import Result
from app.models.result_history import ResultHistory
from app.models.upload_log import UploadLog

ROLLBACK_BATCH_SIZE = 10


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
        prev_history = (
            db.query(ResultHistory).outerjoin(
                UploadLog, ResultHistory.upload_id == UploadLog.id).filter(
                    ResultHistory.result_id == result_id,
                    ResultHistory.upload_id != upload_id,
                    # Accept entries with no upload or with non-deleted uploads
                    (ResultHistory.upload_id.is_(None) |
                     UploadLog.deleted_at.is_(None)),
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


def soft_delete_upload_streaming(
    db: Session,
    upload_id: int,
    batch_size: int = ROLLBACK_BATCH_SIZE,
) -> Generator[dict, None, None] | None:
    """Soft-delete an upload, streaming progress events as results roll back.

    Returns None if upload not found. Otherwise yields:
      - started: {upload_id, total_affected}
      - progress: {processed, total, percentage}  (every batch_size results)
      - complete: {upload_id, message, rolled_back}
      - error: {upload_id, detail}  (on exception)
    """
    upload = (db.query(UploadLog).filter(
        UploadLog.id == upload_id, UploadLog.deleted_at.is_(None)).first())
    if upload is None:
        return None

    def _generate():
        upload.deleted_at = datetime.now(timezone.utc)
        db.flush()

        # Find affected result IDs
        affected_result_ids = [
            row[0] for row in db.query(ResultHistory.result_id).filter(
                ResultHistory.upload_id == upload_id).distinct().all()
        ]

        total_affected = len(affected_result_ids)
        yield {
            "event": "started",
            "upload_id": upload_id,
            "total_affected": total_affected,
        }

        try:
            rolled_back = 0
            for i, result_id in enumerate(affected_result_ids):
                result = db.query(Result).filter(Result.id == result_id).first()
                if result is None or result.upload_id != upload_id:
                    # Not affected by this upload, skip but count
                    rolled_back += 1
                else:
                    prev_history = (db.query(ResultHistory).outerjoin(
                        UploadLog,
                        ResultHistory.upload_id == UploadLog.id,
                    ).filter(
                        ResultHistory.result_id == result_id,
                        ResultHistory.upload_id != upload_id,
                        (ResultHistory.upload_id.is_(None) |
                         UploadLog.deleted_at.is_(None)),
                    ).order_by(ResultHistory.id.desc()).first())

                    if prev_history is not None:
                        result.votes = prev_history.votes
                        result.upload_id = prev_history.upload_id
                    else:
                        db.delete(result)
                    rolled_back += 1

                processed = i + 1
                if processed % batch_size == 0 or processed == total_affected:
                    percentage = (int((processed / total_affected) *
                                      100) if total_affected else 100)
                    yield {
                        "event": "progress",
                        "processed": processed,
                        "total": total_affected,
                        "percentage": percentage,
                    }

            # Clean up history rows
            db.query(ResultHistory).filter(
                ResultHistory.upload_id == upload_id).delete()

            db.commit()
            yield {
                "event": "complete",
                "upload_id": upload_id,
                "message": "Upload deleted",
                "rolled_back": rolled_back,
            }
        except Exception:  # noqa: BLE001
            db.rollback()
            yield {
                "event": "error",
                "upload_id": upload_id,
                "detail": "Delete failed due to a database error",
            }

    return _generate()


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
