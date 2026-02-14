from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class Constituency(Base):
    __tablename__ = "constituencies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    pcon24_code = Column(String(20), unique=True, nullable=True, index=True)
    region_id = Column(Integer,
                       ForeignKey("regions.id"),
                       nullable=True,
                       index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(),
                        onupdate=func.now())

    results = relationship("Result",
                           back_populates="constituency",
                           cascade="all, delete-orphan")
    region = relationship("Region", back_populates="constituencies")
