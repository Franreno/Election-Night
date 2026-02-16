from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Result(Base):
    __tablename__ = "results"

    id = Column(Integer, primary_key=True, index=True)
    constituency_id = Column(
        Integer,
        ForeignKey("constituencies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    party_code = Column(String(10), nullable=False, index=True)
    votes = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(),
                        onupdate=func.now())

    upload_id = Column(
        Integer,
        ForeignKey("upload_logs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    constituency = relationship("Constituency", back_populates="results")
    upload_log = relationship("UploadLog", back_populates="results")
    history = relationship("ResultHistory",
                           back_populates="result",
                           cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("constituency_id",
                         "party_code",
                         name="uq_constituency_party"),
        CheckConstraint("votes >= 0", name="ck_votes_non_negative"),
    )
