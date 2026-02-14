import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Override before importing app modules
os.environ["DATABASE_URL"] = "sqlite://"

from app.database import Base, get_db
from app.main import app
from app.models.constituency import Constituency


@pytest.fixture(scope="function")
def db_engine():
    # Use StaticPool so all connections share the same in-memory database
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    testing_session_local = sessionmaker(autocommit=False,
                                         autoflush=False,
                                         bind=db_engine)
    session = testing_session_local()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_engine):
    testing_session_local = sessionmaker(autocommit=False,
                                         autoflush=False,
                                         bind=db_engine)

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def seed_constituencies(db_session, names: list[str]) -> None:
    """Pre-seed constituencies so upload can match them by name."""
    for name in names:
        db_session.add(Constituency(name=name))
    db_session.commit()
