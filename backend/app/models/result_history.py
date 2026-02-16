from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class ResultHistory(Base):
    __tablename__ = "result_history"

    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(
        Integer,
        ForeignKey("results.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    upload_id = Column(
        Integer,
        ForeignKey("upload_logs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    votes = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    result = relationship("Result", back_populates="history")
    upload_log = relationship("UploadLog", back_populates="result_history")

    __table_args__ = (CheckConstraint("votes >= 0",
                                      name="ck_history_votes_non_negative"), )
