from pydantic import BaseModel

from app.schemas.result import PartyResult


class ConstituencyResponse(BaseModel):
    id: int
    name: str
    total_votes: int
    winning_party_code: str | None
    winning_party_name: str | None
    parties: list[PartyResult]


class ConstituencyListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    constituencies: list[ConstituencyResponse]


class ConstituencySummary(BaseModel):
    id: int
    name: str
    winning_party_code: str | None


class ConstituencySummaryListResponse(BaseModel):
    total: int
    constituencies: list[ConstituencySummary]
