from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.upload_log import UploadLog


def soft_delete_upload(db: Session, upload_id: int) -> UploadLog | None:
    """Soft-delete an upload by setting deleted_at. Returns None if not found."""
    upload = (db.query(UploadLog).filter(
        UploadLog.id == upload_id, UploadLog.deleted_at.is_(None)).first())
    if upload is None:
        return None
    upload.deleted_at = datetime.now(timezone.utc)
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
