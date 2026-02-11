from pydantic import BaseModel


class PartyTotals(BaseModel):
    party_code: str
    party_name: str
    total_votes: int
    seats: int


class TotalResultsResponse(BaseModel):
    total_constituencies: int
    total_votes: int
    parties: list[PartyTotals]
