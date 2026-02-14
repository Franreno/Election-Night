import unicodedata

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models.constituency import Constituency
from app.models.result import Result
from app.models.upload_log import UploadLog
from app.services.parser import ParsedConstituencyResult, parse_file


def _normalize(name: str) -> str:
    """Normalize a constituency name for matching.

    Lowercases, strips commas, and removes Unicode diacritics
    (e.g. ô → o, â → a) so that "Ynys Mon" matches "Ynys Môn".
    """
    s = name.lower().replace(",", "").replace("  ", " ").strip()
    # NFD decomposes characters: ô → o + combining circumflex
    # Then we strip the combining marks (category "Mn")
    decomposed = unicodedata.normalize("NFD", s)
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")


class ConstituencyMatcher:
    """Matches uploaded constituency names to pre-seeded DB records.

    The upload .txt file may use differently-cased names, omit commas, or
    lack Unicode diacritics compared to the official constituency names.

    Matching strategy:
    1. Exact match (case-sensitive)
    2. Case-insensitive exact match
    3. Normalized match: lowercase + strip commas + strip diacritics
       e.g. "Ynys Mon" → "Ynys Môn", "BIRMINGHAM HALL GREEN" → "Birmingham, Hall Green"
    """

    def __init__(self, db: Session):
        all_constituencies = db.query(Constituency).all()
        self._exact: dict[str, Constituency] = {}
        self._lower: dict[str, Constituency] = {}
        self._normalized: dict[str, Constituency] = {}

        for c in all_constituencies:
            self._exact[c.name] = c
            self._lower[c.name.lower()] = c
            self._normalized[_normalize(c.name)] = c

    def find(self, name: str) -> Constituency | None:
        # 1. Exact match (case-sensitive)
        if name in self._exact:
            return self._exact[name]

        # 2. Case-insensitive exact match
        lower = name.lower()
        if lower in self._lower:
            return self._lower[lower]

        # 3. Normalized match (lowercase + strip commas + strip diacritics)
        normalized = _normalize(name)
        if normalized in self._normalized:
            return self._normalized[normalized]

        return None


def ingest_file(db: Session,
                content: str,
                filename: str | None = None) -> UploadLog:
    """Parse and ingest an election results file within a single transaction.

    Valid lines are applied via upserts against pre-seeded constituencies.
    Lines whose constituency name cannot be matched are logged as errors.
    """
    results, errors = parse_file(content)

    upload_log = UploadLog(
        filename=filename,
        status="processing",
        total_lines=len(results) + len(errors),
        processed_lines=0,
        error_lines=len(errors),
        errors=[{
            "line": e.line_number,
            "error": e.error
        } for e in errors],
    )
    db.add(upload_log)
    db.flush()

    try:
        matcher = ConstituencyMatcher(db)

        for parsed in results:
            constituency = matcher.find(parsed.constituency_name)
            if constituency is None:
                upload_log.error_lines += 1
                upload_log.errors = upload_log.errors + [{
                    "line":
                    0,
                    "error":
                    f"No matching constituency for '{parsed.constituency_name}'"
                }]
                flag_modified(upload_log, "errors")
                continue

            _upsert_results(db, constituency, parsed, upload_log.id)
            upload_log.processed_lines += 1

        upload_log.status = "completed"
        upload_log.completed_at = func.now()
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
        # Record the failure in a fresh transaction
        upload_log_fail = UploadLog(
            filename=filename,
            status="failed",
            total_lines=len(results) + len(errors),
            processed_lines=0,
            error_lines=len(errors),
            errors=[{
                "line": e.line_number,
                "error": e.error
            } for e in errors],
            completed_at=func.now(),
        )
        db.add(upload_log_fail)
        db.commit()
        return upload_log_fail

    return upload_log


def _upsert_results(db: Session,
                    constituency: Constituency,
                    parsed: ParsedConstituencyResult,
                    upload_id: int | None = None) -> None:
    """Upsert party results for an existing constituency."""
    dialect = db.bind.dialect.name

    if dialect == "postgresql":
        for party_code, votes in parsed.party_votes.items():
            stmt = pg_insert(Result).values(
                constituency_id=constituency.id,
                party_code=party_code,
                votes=votes,
                upload_id=upload_id,
            )
            stmt = stmt.on_conflict_do_update(
                constraint="uq_constituency_party",
                set_={
                    "votes": votes,
                    "updated_at": func.now(),
                    "upload_id": upload_id,
                },
            )
            db.execute(stmt)
    else:
        for party_code, votes in parsed.party_votes.items():
            result = (db.query(Result).filter(
                Result.constituency_id == constituency.id,
                Result.party_code == party_code,
            ).first())
            if result is None:
                result = Result(
                    constituency_id=constituency.id,
                    party_code=party_code,
                    votes=votes,
                    upload_id=upload_id,
                )
                db.add(result)
            else:
                result.votes = votes
                result.upload_id = upload_id
