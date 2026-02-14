from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.upload_log import UploadLog
from app.schemas.upload import (
    UploadListResponse,
    UploadLogEntry,
    UploadResponse,
    UploadStatsResponse,
)
from app.services.ingestion import ingest_file
from app.services.upload_service import get_upload_stats, soft_delete_upload

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload", response_model=UploadResponse, status_code=201)
async def upload_results(
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
):
    """Upload an election results file for processing.

    Accepts a text file where each line contains a constituency name
    followed by vote/party code pairs. The file is parsed and results
    are upserted into the database atomically.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    content = await file.read()

    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum size is 100MB",
        )

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400,
                            detail="File must be UTF-8 encoded text")

    if not text.strip():
        raise HTTPException(status_code=400, detail="File is empty")

    upload_log = ingest_file(db, text, filename=file.filename)

    if upload_log.status == "failed":
        raise HTTPException(
            status_code=500,
            detail="File processing failed due to a database error",
        )

    return UploadResponse(
        upload_id=upload_log.id,
        status=upload_log.status,
        total_lines=upload_log.total_lines,
        processed_lines=upload_log.processed_lines,
        error_lines=upload_log.error_lines,
        errors=upload_log.errors,
    )


@router.get("/uploads/stats", response_model=UploadStatsResponse)
def upload_stats(db: Session = Depends(get_db)):
    """Return aggregate upload statistics."""
    return get_upload_stats(db)


@router.get("/uploads", response_model=UploadListResponse)
def list_uploads(
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=20, ge=1, le=100),
        status: str | None = Query(default=None),
        search: str | None = Query(default=None),
        db: Session = Depends(get_db),
):
    """List all upload logs, ordered newest first."""
    query = db.query(UploadLog).filter(UploadLog.deleted_at.is_(None))

    if status:
        query = query.filter(UploadLog.status == status)
    if search:
        query = query.filter(UploadLog.filename.ilike(f"%{search}%"))

    total = query.count()
    offset = (page - 1) * page_size
    uploads = (query.order_by(
        UploadLog.id.desc()).offset(offset).limit(page_size).all())
    return UploadListResponse(
        total=total,
        page=page,
        page_size=page_size,
        uploads=[UploadLogEntry.model_validate(u) for u in uploads],
    )


@router.delete("/uploads/{upload_id}")
def delete_upload(upload_id: int, db: Session = Depends(get_db)):
    """Soft-delete an upload log entry."""
    upload = soft_delete_upload(db, upload_id)
    if upload is None:
        raise HTTPException(status_code=404, detail="Upload not found")
    return {"message": "Upload deleted"}
