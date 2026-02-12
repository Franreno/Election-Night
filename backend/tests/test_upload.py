import io


class TestUploadEndpoint:

    def test_upload_valid_file(self, client):
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

    def test_upload_with_parse_errors(self, client):
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

    def test_upload_with_escaped_commas(self, client):
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

    def test_upload_idempotent(self, client):
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
        resp = client.get("/api/constituencies")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    def test_upload_updates_existing_party(self, client):
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
        resp = client.get("/api/constituencies")
        constituency = resp.json()["constituencies"][0]
        votes_by_party = {
            p["party_code"]: p["votes"]
            for p in constituency["parties"]
        }
        assert votes_by_party["C"] == 999
        assert votes_by_party["L"] == 200

    def test_upload_preserves_unmentioned_parties(self, client):
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
        resp = client.get("/api/constituencies")
        constituency = resp.json()["constituencies"][0]
        votes_by_party = {
            p["party_code"]: p["votes"]
            for p in constituency["parties"]
        }
        assert votes_by_party["C"] == 150
        assert votes_by_party["L"] == 200
        assert votes_by_party["LD"] == 300


class TestListUploadsEndpoint:

    def test_list_uploads_empty(self, client):
        resp = client.get("/api/uploads")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["uploads"] == []

    def test_list_uploads_after_upload(self, client):
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

    def test_list_uploads_pagination(self, client):
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

    def test_list_uploads_ordered_by_id_descending(self, client):
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
