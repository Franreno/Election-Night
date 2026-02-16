from sqlalchemy import JSON, Column, DateTime, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class UploadLog(Base):
    __tablename__ = "upload_logs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(512))
    status = Column(String(20), nullable=False, default="processing")
    total_lines = Column(Integer)
    processed_lines = Column(Integer, default=0)
    error_lines = Column(Integer, default=0)
    errors = Column(JSON, default=list)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    results = relationship("Result", back_populates="upload_log")
    result_history = relationship("ResultHistory",
                                  back_populates="upload_log")
