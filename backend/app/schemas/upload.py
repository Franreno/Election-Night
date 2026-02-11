from pydantic import BaseModel
from typing import Any


class UploadResponse(BaseModel):
    upload_id: int
    status: str
    total_lines: int | None
    processed_lines: int | None
    error_lines: int | None
    errors: list[Any] | None
