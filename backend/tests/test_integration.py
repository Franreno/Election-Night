"""End-to-end API integration tests.

These tests exercise full user flows through the API:
upload file → parse → store → retrieve results via different endpoints.
"""

import io

from tests.conftest import seed_constituencies

CONSTITUENCIES = [
    "Bedford",
    "Sheffield Hallam",
    "Bristol West",
    "City of Durham",
]

VALID_FILE = (
    "Bedford,6643,C,5276,L,2049,LD,266,Ind,2531,UKIP,2671,G\n"
    "Sheffield Hallam,8788,C,4277,L,3000,LD,500,Ind,1200,UKIP,900,G\n"
    "Bristol West,3000,C,9000,L,2000,LD,100,Ind,500,UKIP,4000,G\n"
    "City Of Durham,4000,C,7000,L,1500,LD,300,Ind,800,UKIP,600,G\n")


class TestFullUploadToRetrieveFlow:
    """Test: upload a file → verify results appear across all endpoints."""

    def test_upload_then_list_constituencies(self, client, db_session):
        seed_constituencies(db_session, CONSTITUENCIES)

        # Upload
        resp = client.post(
            "/api/upload",
            files={
                "file":
                ("results.txt", io.BytesIO(VALID_FILE.encode()), "text/plain")
            },
        )
        assert resp.status_code == 201
        upload_data = resp.json()
        assert upload_data["status"] == "completed"
        assert upload_data["processed_lines"] == 4
        assert upload_data["error_lines"] == 0

        # List constituencies
        resp = client.get("/api/constituencies")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 4
        names = {c["name"] for c in data["constituencies"]}
        assert names == set(CONSTITUENCIES)

    def test_upload_then_check_totals(self, client, db_session):
        seed_constituencies(db_session, CONSTITUENCIES)

        client.post(
            "/api/upload",
            files={
                "file":
                ("results.txt", io.BytesIO(VALID_FILE.encode()), "text/plain")
            },
        )

        # Check totals
        resp = client.get("/api/totals")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_constituencies"] == 4
        assert data["total_votes"] > 0

        parties = {p["party_code"]: p for p in data["parties"]}
        assert "C" in parties
        assert "L" in parties
        # Each party should have correct aggregated votes
        assert parties["C"]["total_votes"] == 6643 + 8788 + 3000 + 4000
        assert parties["L"]["total_votes"] == 5276 + 4277 + 9000 + 7000

    def test_upload_then_view_single_constituency(self, client, db_session):
        seed_constituencies(db_session, CONSTITUENCIES)

        client.post(
            "/api/upload",
            files={
                "file":
                ("results.txt", io.BytesIO(VALID_FILE.encode()), "text/plain")
            },
        )

        # Get list to find Bedford's ID
        resp = client.get("/api/constituencies?search=Bedford")
        bedford_id = resp.json()["constituencies"][0]["id"]

        # Get single constituency
        resp = client.get(f"/api/constituencies/{bedford_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Bedford"
        assert data["total_votes"] == 6643 + 5276 + 2049 + 266 + 2531 + 2671
        assert data["winning_party_code"] == "C"
        assert len(data["parties"]) == 6

    def test_upload_then_check_summary(self, client, db_session):
        seed_constituencies(db_session, CONSTITUENCIES)

        client.post(
            "/api/upload",
            files={
                "file":
                ("results.txt", io.BytesIO(VALID_FILE.encode()), "text/plain")
            },
        )

        # Check summary endpoint (used by map)
        resp = client.get("/api/constituencies/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 4
        for c in data["constituencies"]:
            assert "winning_party_code" in c
            assert "name" in c

    def test_upload_then_check_upload_history(self, client, db_session):
        seed_constituencies(db_session, CONSTITUENCIES)

        client.post(
            "/api/upload",
            files={
                "file":
                ("results.txt", io.BytesIO(VALID_FILE.encode()), "text/plain")
            },
        )

        # Check upload appears in history
        resp = client.get("/api/uploads")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        latest = data["uploads"][0]
        assert latest["filename"] == "results.txt"
        assert latest["status"] == "completed"
        assert latest["processed_lines"] == 4


class TestUpdateOverrideSemantics:
    """Test: uploading updated data overrides previous results."""

    def test_second_upload_updates_votes(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])

        # First upload
        file1 = "Bedford,1000,C,2000,L"
        client.post(
            "/api/upload",
            files={
                "file": ("first.txt", io.BytesIO(file1.encode()), "text/plain")
            },
        )

        resp = client.get("/api/constituencies?search=Bedford")
        bedford = resp.json()["constituencies"][0]
        assert bedford["total_votes"] == 3000

        # Second upload with different votes
        file2 = "Bedford,5000,C,3000,L"
        client.post(
            "/api/upload",
            files={
                "file":
                ("second.txt", io.BytesIO(file2.encode()), "text/plain")
            },
        )

        resp = client.get("/api/constituencies?search=Bedford")
        bedford = resp.json()["constituencies"][0]
        assert bedford["total_votes"] == 8000

    def test_update_preserves_unmentioned_parties(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])

        # First upload: C, L, LD
        file1 = "Bedford,1000,C,2000,L,500,LD"
        client.post(
            "/api/upload",
            files={
                "file": ("first.txt", io.BytesIO(file1.encode()), "text/plain")
            },
        )

        # Second upload: only C and L (LD not mentioned)
        file2 = "Bedford,5000,C,3000,L"
        client.post(
            "/api/upload",
            files={
                "file":
                ("second.txt", io.BytesIO(file2.encode()), "text/plain")
            },
        )

        resp = client.get("/api/constituencies?search=Bedford")
        bedford = resp.json()["constituencies"][0]
        party_codes = {p["party_code"] for p in bedford["parties"]}
        # LD should still be present from first upload
        assert "LD" in party_codes
        assert "C" in party_codes
        assert "L" in party_codes

    def test_update_changes_winner(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])

        # First: C wins
        client.post(
            "/api/upload",
            files={
                "file":
                ("f1.txt", io.BytesIO(b"Bedford,5000,C,3000,L"), "text/plain")
            },
        )
        resp = client.get("/api/constituencies?search=Bedford")
        assert resp.json()["constituencies"][0]["winning_party_code"] == "C"

        # Second: L wins
        client.post(
            "/api/upload",
            files={
                "file":
                ("f2.txt", io.BytesIO(b"Bedford,3000,C,8000,L"), "text/plain")
            },
        )
        resp = client.get("/api/constituencies?search=Bedford")
        assert resp.json()["constituencies"][0]["winning_party_code"] == "L"


class TestSearchAndPaginationFlow:
    """Test: upload data then exercise search, pagination, and sorting."""

    def test_search_filters_correctly(self, client, db_session):
        seed_constituencies(db_session, CONSTITUENCIES)
        client.post(
            "/api/upload",
            files={
                "file":
                ("r.txt", io.BytesIO(VALID_FILE.encode()), "text/plain")
            },
        )

        resp = client.get("/api/constituencies?search=sheffield")
        data = resp.json()
        assert data["total"] == 1
        assert data["constituencies"][0]["name"] == "Sheffield Hallam"

    def test_pagination_works(self, client, db_session):
        seed_constituencies(db_session, CONSTITUENCIES)
        client.post(
            "/api/upload",
            files={
                "file":
                ("r.txt", io.BytesIO(VALID_FILE.encode()), "text/plain")
            },
        )

        # Page 1 with size 2
        resp = client.get("/api/constituencies?page=1&page_size=2")
        data = resp.json()
        assert data["total"] == 4
        assert len(data["constituencies"]) == 2
        assert data["page"] == 1

        # Page 2
        resp = client.get("/api/constituencies?page=2&page_size=2")
        data = resp.json()
        assert len(data["constituencies"]) == 2
        assert data["page"] == 2

    def test_sorting_by_total_votes(self, client, db_session):
        seed_constituencies(db_session, CONSTITUENCIES)
        client.post(
            "/api/upload",
            files={
                "file":
                ("r.txt", io.BytesIO(VALID_FILE.encode()), "text/plain")
            },
        )

        resp = client.get(
            "/api/constituencies?sort_by=total_votes&sort_dir=desc")
        data = resp.json()
        votes = [c["total_votes"] for c in data["constituencies"]]
        assert votes == sorted(votes, reverse=True)


class TestErrorHandlingFlow:
    """Test: upload files with errors and verify error reporting."""

    def test_upload_with_mixed_valid_invalid(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])

        content = "Bedford,6643,C,5276,L\nBadLine\nAlsoInvalid,abc,C"
        resp = client.post(
            "/api/upload",
            files={
                "file":
                ("mixed.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["processed_lines"] == 1
        assert data["error_lines"] >= 2
        assert len(data["errors"]) >= 2

    def test_upload_with_unmatched_constituencies(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])

        content = "Bedford,1000,C,2000,L\nNonexistent,500,C,300,L"
        resp = client.post(
            "/api/upload",
            files={
                "file":
                ("unmatched.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["processed_lines"] == 1
        # Unmatched constituency is an error
        assert data["error_lines"] >= 1

    def test_empty_file_upload_rejected(self, client, db_session):
        resp = client.post(
            "/api/upload",
            files={"file": ("empty.txt", io.BytesIO(b""), "text/plain")},
        )
        assert resp.status_code == 400

    def test_nonexistent_constituency_returns_404(self, client, db_session):
        resp = client.get("/api/constituencies/99999")
        assert resp.status_code == 404


class TestHealthEndpoint:
    """Test: health check is always available."""

    def test_health_returns_ok(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
