from pydantic import BaseModel


class PartyResult(BaseModel):
    party_code: str
    party_name: str
    votes: int
    percentage: float
