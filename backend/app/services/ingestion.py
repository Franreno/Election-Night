from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.constituency import Constituency
from app.models.result import Result
from app.models.upload_log import UploadLog
from app.services.parser import ParsedConstituencyResult, parse_file


def ingest_file(db: Session,
                content: str,
                filename: str | None = None) -> UploadLog:
    """Parse and ingest an election results file within a single transaction.

    Valid lines are applied via upserts. Parse errors are logged but don't
    block other lines. A database error rolls back the entire transaction.
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
        for parsed in results:
            _upsert_constituency_result(db, parsed)
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


def _upsert_constituency_result(db: Session,
                                parsed: ParsedConstituencyResult) -> None:
    """Upsert a single constituency and its party results.

    Uses PostgreSQL ON CONFLICT when available, falls back to
    query-then-update for other dialects (e.g., SQLite in tests).
    """
    dialect = db.bind.dialect.name

    if dialect == "postgresql":
        _upsert_postgresql(db, parsed)
    else:
        _upsert_generic(db, parsed)


def _upsert_postgresql(db: Session, parsed: ParsedConstituencyResult) -> None:
    """PostgreSQL-specific upsert using INSERT ... ON CONFLICT DO UPDATE."""
    stmt = pg_insert(Constituency).values(name=parsed.constituency_name)
    stmt = stmt.on_conflict_do_update(
        index_elements=["name"],
        set_={"updated_at": func.now()},
    )
    db.execute(stmt)
    db.flush()

    constituency = (db.query(Constituency).filter(
        Constituency.name == parsed.constituency_name).one())

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


def _upsert_generic(db: Session, parsed: ParsedConstituencyResult) -> None:
    """Dialect-agnostic upsert using query + merge pattern."""
    constituency = (db.query(Constituency).filter(
        Constituency.name == parsed.constituency_name).first())
    if constituency is None:
        constituency = Constituency(name=parsed.constituency_name)
        db.add(constituency)
        db.flush()

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
