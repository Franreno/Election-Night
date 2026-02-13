import io

from tests.conftest import seed_constituencies


class TestUploadEndpoint:

    def test_upload_valid_file(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])
        content = "Bedford,6643,C,5276,L,2049,LD,266,Ind,2531,UKIP,2671,G\n"
        response = client.post(
            "/api/upload",
            files={
                "file":
                ("results.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "completed"
        assert data["processed_lines"] == 1
        assert data["error_lines"] == 0

    def test_upload_empty_file(self, client):
        response = client.post(
            "/api/upload",
            files={"file": ("empty.txt", io.BytesIO(b""), "text/plain")},
        )
        assert response.status_code == 400

    def test_upload_whitespace_only_file(self, client):
        response = client.post(
            "/api/upload",
            files={
                "file": ("spaces.txt", io.BytesIO(b"   \n\n  "), "text/plain")
            },
        )
        assert response.status_code == 400

    def test_upload_with_parse_errors(self, client, db_session):
        seed_constituencies(db_session, ["Bedford", "Oxford"])
        content = "Bedford,100,C,200,L\nBadLine\nOxford,300,C,400,L\n"
        response = client.post(
            "/api/upload",
            files={
                "file":
                ("mixed.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "completed"
        assert data["processed_lines"] == 2
        assert data["error_lines"] == 1
        assert len(data["errors"]) == 1

    def test_upload_with_escaped_commas(self, client, db_session):
        seed_constituencies(db_session, ["Sheffield, Hallam"])
        content = "Sheffield\\, Hallam,8788,C,4277,L\n"
        response = client.post(
            "/api/upload",
            files={
                "file":
                ("escaped.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["processed_lines"] == 1

    def test_upload_unmatched_constituency_logged_as_error(self, client):
        # No constituencies seeded — upload should log errors, not create rows
        content = "Nonexistent,100,C,200,L\n"
        response = client.post(
            "/api/upload",
            files={
                "file":
                ("bad.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["processed_lines"] == 0
        assert data["error_lines"] == 1
        assert "No matching constituency" in data["errors"][0]["error"]

    def test_upload_idempotent(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])
        content = "Bedford,100,C,200,L\n"
        # Upload twice
        client.post("/api/upload",
                    files={
                        "file":
                        ("r1.txt", io.BytesIO(content.encode()), "text/plain")
                    })
        response = client.post(
            "/api/upload",
            files={
                "file": ("r2.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        assert response.status_code == 201
        # Check that constituency still exists with same data
        resp = client.get("/api/constituencies?search=Bedford")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    def test_upload_updates_existing_party(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])
        # First upload
        client.post(
            "/api/upload",
            files={
                "file":
                ("r1.txt", io.BytesIO(b"Bedford,100,C,200,L"), "text/plain")
            },
        )
        # Second upload with updated votes for C
        client.post(
            "/api/upload",
            files={
                "file": ("r2.txt", io.BytesIO(b"Bedford,999,C"), "text/plain")
            },
        )
        # Verify: C should be 999, L should remain 200
        resp = client.get("/api/constituencies?search=Bedford")
        constituency = resp.json()["constituencies"][0]
        votes_by_party = {
            p["party_code"]: p["votes"]
            for p in constituency["parties"]
        }
        assert votes_by_party["C"] == 999
        assert votes_by_party["L"] == 200

    def test_upload_preserves_unmentioned_parties(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])
        # First upload with C and L
        client.post(
            "/api/upload",
            files={
                "file": ("r1.txt", io.BytesIO(b"Bedford,100,C,200,L,300,LD"),
                         "text/plain")
            },
        )
        # Second upload mentions only C
        client.post(
            "/api/upload",
            files={
                "file": ("r2.txt", io.BytesIO(b"Bedford,150,C"), "text/plain")
            },
        )
        resp = client.get("/api/constituencies?search=Bedford")
        constituency = resp.json()["constituencies"][0]
        votes_by_party = {
            p["party_code"]: p["votes"]
            for p in constituency["parties"]
        }
        assert votes_by_party["C"] == 150
        assert votes_by_party["L"] == 200
        assert votes_by_party["LD"] == 300

    def test_upload_starts_with_matching(self, client, db_session):
        """Upload with abbreviated name matches 'X and Y' constituency."""
        seed_constituencies(db_session, ["Broadland and Fakenham"])
        content = "Broadland,500,C,300,L\n"
        response = client.post(
            "/api/upload",
            files={
                "file":
                ("r.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["processed_lines"] == 1
        assert data["error_lines"] == 0

        # Results attached to the official name
        resp = client.get(
            "/api/constituencies?search=Broadland%20and%20Fakenham")
        c = resp.json()["constituencies"][0]
        assert c["name"] == "Broadland and Fakenham"
        assert c["winning_party_code"] == "C"

    def test_upload_case_insensitive_matching(self, client, db_session):
        """'City Of Durham' matches 'City of Durham'."""
        seed_constituencies(db_session, ["City of Durham"])
        content = "City Of Durham,500,C,300,L\n"
        response = client.post(
            "/api/upload",
            files={
                "file":
                ("r.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        data = response.json()
        assert data["processed_lines"] == 1
        assert data["error_lines"] == 0

    def test_upload_ends_with_matching(self, client, db_session):
        """'Eddisbury' matches 'Chester South and Eddisbury'."""
        seed_constituencies(db_session, ["Chester South and Eddisbury"])
        content = "Eddisbury,500,C,300,L\n"
        response = client.post(
            "/api/upload",
            files={
                "file":
                ("r.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        data = response.json()
        assert data["processed_lines"] == 1
        assert data["error_lines"] == 0

    def test_upload_comma_stripped_matching(self, client, db_session):
        """'Birmingham, Hall Green' matches 'Birmingham Hall Green and Moseley'."""
        seed_constituencies(
            db_session, ["Birmingham Hall Green and Moseley"])
        content = "Birmingham\\, Hall Green,500,C,300,L\n"
        response = client.post(
            "/api/upload",
            files={
                "file":
                ("r.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        data = response.json()
        assert data["processed_lines"] == 1
        assert data["error_lines"] == 0

    def test_upload_comma_exact_after_strip(self, client, db_session):
        """'Sheffield, Hallam' matches 'Sheffield Hallam' after comma strip."""
        seed_constituencies(db_session, ["Sheffield Hallam"])
        content = "Sheffield\\, Hallam,500,C,300,L\n"
        response = client.post(
            "/api/upload",
            files={
                "file":
                ("r.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        data = response.json()
        assert data["processed_lines"] == 1
        assert data["error_lines"] == 0

    def test_upload_ambiguous_match_is_error(self, client, db_session):
        """Ambiguous starts-with match (multiple candidates) is an error."""
        seed_constituencies(db_session, [
            "Leeds Central and Headingley",
            "Leeds Central and Pudsey",
        ])
        content = "Leeds Central,500,C,300,L\n"
        response = client.post(
            "/api/upload",
            files={
                "file":
                ("r.txt", io.BytesIO(content.encode()), "text/plain")
            },
        )
        data = response.json()
        assert data["processed_lines"] == 0
        assert data["error_lines"] == 1


class TestListUploadsEndpoint:

    def test_list_uploads_empty(self, client):
        resp = client.get("/api/uploads")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["uploads"] == []

    def test_list_uploads_after_upload(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])
        client.post(
            "/api/upload",
            files={
                "file":
                ("r.txt", io.BytesIO(b"Bedford,100,C,200,L"), "text/plain")
            },
        )
        resp = client.get("/api/uploads")
        data = resp.json()
        assert data["total"] == 1
        assert data["uploads"][0]["status"] == "completed"
        assert data["uploads"][0]["filename"] == "r.txt"

    def test_list_uploads_pagination(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])
        for i in range(3):
            client.post(
                "/api/upload",
                files={
                    "file": (f"r{i}.txt", io.BytesIO(b"Bedford,100,C,200,L"),
                             "text/plain")
                },
            )
        resp = client.get("/api/uploads?page=1&page_size=2")
        data = resp.json()
        assert data["total"] == 3
        assert len(data["uploads"]) == 2

    def test_list_uploads_ordered_by_id_descending(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])
        for i in range(3):
            client.post(
                "/api/upload",
                files={
                    "file": (f"r{i}.txt", io.BytesIO(b"Bedford,100,C,200,L"),
                             "text/plain")
                },
            )
        resp = client.get("/api/uploads")
        ids = [u["id"] for u in resp.json()["uploads"]]
        assert ids == sorted(ids, reverse=True)
