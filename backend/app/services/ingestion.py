from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models.constituency import Constituency
from app.models.result import Result
from app.models.upload_log import UploadLog
from app.services.parser import ParsedConstituencyResult, parse_file


class ConstituencyMatcher:
    """Matches uploaded constituency names to pre-seeded DB records.

    The upload .txt file often uses abbreviated or differently-cased names
    compared to the official 2024 constituency names. This matcher handles:

    1. Exact match (case-sensitive)
    2. Case-insensitive exact match
       "City Of Durham" → "City of Durham"
    3. Official name starts with uploaded name (word boundary)
       "Broadland" → "Broadland and Fakenham"
       "Sherwood" → "Sherwood Forest"
    4. Official name ends with uploaded name (word boundary)
       "Eddisbury" → "Chester South and Eddisbury"
       "Workington" → "Whitehaven and Workington"
    5. Official name starts with uploaded name + "shire"
       "Monmouth" → "Monmouthshire"

    Commas in uploaded names are stripped before fuzzy matching (steps 3-5),
    e.g. "Birmingham, Hall Green" → "Birmingham Hall Green" which then
    matches "Birmingham Hall Green and Moseley" via starts-with.

    Only single matches are accepted; ambiguous matches are rejected.
    """

    def __init__(self, db: Session):
        all_constituencies = db.query(Constituency).all()
        self._exact: dict[str, Constituency] = {}
        self._lower: dict[str, Constituency] = {}
        self._all: list[Constituency] = list(all_constituencies)

        for c in all_constituencies:
            self._exact[c.name] = c
            self._lower[c.name.lower()] = c

    def find(self, name: str) -> Constituency | None:
        # 1. Exact match (case-sensitive)
        if name in self._exact:
            return self._exact[name]

        # 2. Case-insensitive exact match
        lower = name.lower()
        if lower in self._lower:
            return self._lower[lower]

        # Strip commas for fuzzy matching (steps 3-5)
        # e.g. "Birmingham, Hall Green" → "birmingham hall green"
        normalized = lower.replace(",", "").replace("  ", " ").strip()

        # 3. Official name starts with uploaded name + space
        candidates = [
            c for c in self._all
            if c.name.lower().startswith(normalized + " ")
        ]
        if len(candidates) == 1:
            return candidates[0]

        # 4. Official name ends with " " + uploaded name
        suffix = " " + normalized
        candidates = [
            c for c in self._all if c.name.lower().endswith(suffix)
        ]
        if len(candidates) == 1:
            return candidates[0]

        # 5. Official name starts with uploaded name + "shire"
        #    e.g. "Monmouth" → "Monmouthshire"
        candidates = [
            c for c in self._all
            if c.name.lower().startswith(normalized + "shire")
        ]
        if len(candidates) == 1:
            return candidates[0]

        # 6. Case-insensitive match after stripping commas
        if normalized != lower and normalized in self._lower:
            return self._lower[normalized]

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

            _upsert_results(db, constituency, parsed)
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


def _upsert_results(db: Session, constituency: Constituency,
                    parsed: ParsedConstituencyResult) -> None:
    """Upsert party results for an existing constituency."""
    dialect = db.bind.dialect.name

    if dialect == "postgresql":
        for party_code, votes in parsed.party_votes.items():
            stmt = pg_insert(Result).values(
                constituency_id=constituency.id,
                party_code=party_code,
                votes=votes,
            )
            stmt = stmt.on_conflict_do_update(
                constraint="uq_constituency_party",
                set_={
                    "votes": votes,
                    "updated_at": func.now(),
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
                )
                db.add(result)
            else:
                result.votes = votes
