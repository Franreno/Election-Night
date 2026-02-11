from dataclasses import dataclass, field

from app.constants import VALID_PARTY_CODES


@dataclass
class ParsedConstituencyResult:
    constituency_name: str
    party_votes: dict[str, int] = field(default_factory=dict)


@dataclass
class ParseError:
    line_number: int
    raw_line: str
    error: str


def parse_line(raw_line: str,
               line_number: int) -> ParsedConstituencyResult | ParseError:
    """Parse a single line from an election results file.

    Handles escaped commas in constituency names (e.g., 'Sheffield\\, Hallam').
    Format: constituency_name,votes1,party_code1,votes2,party_code2,...
    """
    raw_line = raw_line.strip()
    if not raw_line:
        return ParseError(line_number, raw_line, "Empty line")

    # Handle escaped commas: replace \, with a placeholder, split, then restore
    placeholder = "\x00"
    working = raw_line.replace("\\,", placeholder)
    fields = [f.replace(placeholder, ",").strip() for f in working.split(",")]

    if len(fields) < 3:
        return ParseError(
            line_number, raw_line,
            "Too few fields: need at least constituency name and one vote/party pair"
        )

    constituency_name = fields[0]
    if not constituency_name:
        return ParseError(line_number, raw_line, "Empty constituency name")

    remaining = fields[1:]
    if len(remaining) % 2 != 0:
        return ParseError(
            line_number,
            raw_line,
            f"Odd number of vote/party fields ({len(remaining)}); expected pairs of votes and party codes",
        )

    party_votes: dict[str, int] = {}
    for i in range(0, len(remaining), 2):
        votes_str = remaining[i]
        party_code = remaining[i + 1]

        try:
            votes = int(votes_str)
        except ValueError:
            return ParseError(
                line_number, raw_line,
                f"Invalid vote count '{votes_str}' at position {i + 2}")

        if votes < 0:
            return ParseError(
                line_number, raw_line,
                f"Negative vote count {votes} for party '{party_code}'")

        if party_code not in VALID_PARTY_CODES:
            return ParseError(line_number, raw_line,
                              f"Unknown party code '{party_code}'")

        if party_code in party_votes:
            return ParseError(
                line_number, raw_line,
                f"Duplicate party code '{party_code}' in same line")

        party_votes[party_code] = votes

    return ParsedConstituencyResult(constituency_name=constituency_name,
                                    party_votes=party_votes)


def parse_file(
        content: str
) -> tuple[list[ParsedConstituencyResult], list[ParseError]]:
    """Parse an entire election results file.

    Returns (successful_results, parse_errors). Errors don't block valid lines.
    """
    results: list[ParsedConstituencyResult] = []
    errors: list[ParseError] = []

    for line_number, line in enumerate(content.splitlines(), start=1):
        if not line.strip():
            continue
        parsed = parse_line(line, line_number)
        if isinstance(parsed, ParseError):
            errors.append(parsed)
        else:
            results.append(parsed)

    return results, errors
