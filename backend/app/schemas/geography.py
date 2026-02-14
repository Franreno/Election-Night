from pydantic import BaseModel


class RegionSummary(BaseModel):
    id: int
    name: str
    sort_order: int
    constituency_count: int


class RegionListResponse(BaseModel):
    regions: list[RegionSummary]


class RegionConstituency(BaseModel):
    id: int
    name: str
    pcon24_code: str | None
    winning_party_code: str | None


class RegionDetail(BaseModel):
    id: int
    name: str
    pcon24_codes: list[str]
    constituencies: list[RegionConstituency]
