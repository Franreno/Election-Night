from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class UploadResponse(BaseModel):
    upload_id: int
    status: str
    total_lines: int | None
    processed_lines: int | None
    error_lines: int | None
    errors: list[Any] | None


class UploadLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str | None
    status: str
    total_lines: int | None
    processed_lines: int | None
    error_lines: int | None
    errors: list[Any] | None
    started_at: datetime | None
    completed_at: datetime | None
    deleted_at: datetime | None = None


class UploadListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    uploads: list[UploadLogEntry]


class UploadStatsResponse(BaseModel):
    total_uploads: int
    completed: int
    failed: int
    success_rate: float
    total_lines_processed: int
