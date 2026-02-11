PARTY_CODE_MAP: dict[str, str] = {
    "C": "Conservative Party",
    "L": "Labour Party",
    "UKIP": "UKIP",
    "LD": "Liberal Democrats",
    "G": "Green Party",
    "Ind": "Independent",
    "SNP": "SNP",
}

VALID_PARTY_CODES: set[str] = set(PARTY_CODE_MAP.keys())
