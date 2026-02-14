from pydantic import BaseModel

from app.schemas.result import PartyResult


class ConstituencyResponse(BaseModel):
    id: int
    name: str
    pcon24_code: str | None
    region_id: int | None
    region_name: str | None
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
    pcon24_code: str | None
    region_name: str | None
    winning_party_code: str | None


class ConstituencySummaryListResponse(BaseModel):
    total: int
    constituencies: list[ConstituencySummary]
