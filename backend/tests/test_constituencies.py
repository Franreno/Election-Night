import io


class TestConstituenciesEndpoint:

    def _seed_data(self, client):
        content = ("Bedford,6643,C,5276,L,2049,LD,266,Ind,2531,UKIP,2671,G\n"
                   "Oxford,3000,C,8000,L,1500,LD,200,Ind,500,UKIP,1000,G\n"
                   "Cambridge,9789,C,8708,L,410,LD,158,Ind,2054,UKIP,3416,G\n")
        client.post("/api/upload",
                    files={
                        "file": ("seed.txt", io.BytesIO(content.encode()),
                                 "text/plain")
                    })

    def test_list_empty(self, client):
        resp = client.get("/api/constituencies")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["constituencies"] == []

    def test_list_with_data(self, client):
        self._seed_data(client)
        resp = client.get("/api/constituencies")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert len(data["constituencies"]) == 3

    def test_list_pagination(self, client):
        self._seed_data(client)
        resp = client.get("/api/constituencies?page=1&page_size=2")
        data = resp.json()
        assert data["total"] == 3
        assert len(data["constituencies"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 2

    def test_list_search(self, client):
        self._seed_data(client)
        resp = client.get("/api/constituencies?search=bed")
        data = resp.json()
        assert data["total"] == 1
        assert data["constituencies"][0]["name"] == "Bedford"

    def test_get_single_constituency(self, client):
        self._seed_data(client)
        # Get the list to find an ID
        list_resp = client.get("/api/constituencies?search=Bedford")
        constituency_id = list_resp.json()["constituencies"][0]["id"]

        resp = client.get(f"/api/constituencies/{constituency_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Bedford"
        assert len(data["parties"]) == 6
        assert data["total_votes"] == 6643 + 5276 + 2049 + 266 + 2531 + 2671

    def test_get_nonexistent_constituency(self, client):
        resp = client.get("/api/constituencies/99999")
        assert resp.status_code == 404

    def test_constituency_has_winning_party(self, client):
        self._seed_data(client)
        resp = client.get("/api/constituencies?search=Bedford")
        constituency = resp.json()["constituencies"][0]
        # Bedford: C has 6643 (highest)
        assert constituency["winning_party_code"] == "C"
        assert constituency["winning_party_name"] == "Conservative Party"

    def test_constituency_percentages_sum_to_100(self, client):
        self._seed_data(client)
        resp = client.get("/api/constituencies?search=Bedford")
        constituency = resp.json()["constituencies"][0]
        total_pct = sum(p["percentage"] for p in constituency["parties"])
        assert 99.9 <= total_pct <= 100.1  # Allow small rounding variance

    def test_parties_sorted_by_votes_descending(self, client):
        self._seed_data(client)
        resp = client.get("/api/constituencies?search=Bedford")
        constituency = resp.json()["constituencies"][0]
        votes = [p["votes"] for p in constituency["parties"]]
        assert votes == sorted(votes, reverse=True)

    def test_tied_votes_no_winner(self, client):
        content = "TiedTown,100,C,100,L\n"
        client.post("/api/upload",
                    files={
                        "file": ("tied.txt", io.BytesIO(content.encode()),
                                 "text/plain")
                    })
        resp = client.get("/api/constituencies?search=TiedTown")
        constituency = resp.json()["constituencies"][0]
        assert constituency["winning_party_code"] is None
        assert constituency["winning_party_name"] is None


class TestConstituencySorting:

    def _seed_data(self, client):
        # Bedford: C wins (6643), total=19436
        # Oxford: L wins (8000), total=14200
        # Cambridge: C wins (9789), total=24535
        content = ("Bedford,6643,C,5276,L,2049,LD,266,Ind,2531,UKIP,2671,G\n"
                   "Oxford,3000,C,8000,L,1500,LD,200,Ind,500,UKIP,1000,G\n"
                   "Cambridge,9789,C,8708,L,410,LD,158,Ind,2054,UKIP,3416,G\n")
        client.post("/api/upload",
                    files={
                        "file": ("seed.txt", io.BytesIO(content.encode()),
                                 "text/plain")
                    })

    def test_sort_by_name_asc(self, client):
        self._seed_data(client)
        resp = client.get("/api/constituencies?sort_by=name&sort_dir=asc")
        names = [c["name"] for c in resp.json()["constituencies"]]
        assert names == ["Bedford", "Cambridge", "Oxford"]

    def test_sort_by_name_desc(self, client):
        self._seed_data(client)
        resp = client.get("/api/constituencies?sort_by=name&sort_dir=desc")
        names = [c["name"] for c in resp.json()["constituencies"]]
        assert names == ["Oxford", "Cambridge", "Bedford"]

    def test_sort_by_total_votes_desc(self, client):
        self._seed_data(client)
        resp = client.get(
            "/api/constituencies?sort_by=total_votes&sort_dir=desc")
        names = [c["name"] for c in resp.json()["constituencies"]]
        # Cambridge 24535 > Bedford 19436 > Oxford 14200
        assert names == ["Cambridge", "Bedford", "Oxford"]

    def test_sort_by_total_votes_asc(self, client):
        self._seed_data(client)
        resp = client.get(
            "/api/constituencies?sort_by=total_votes&sort_dir=asc")
        names = [c["name"] for c in resp.json()["constituencies"]]
        assert names == ["Oxford", "Bedford", "Cambridge"]

    def test_sort_by_winning_party(self, client):
        self._seed_data(client)
        resp = client.get(
            "/api/constituencies?sort_by=winning_party&sort_dir=asc")
        data = resp.json()["constituencies"]
        parties = [c["winning_party_code"] for c in data]
        # C comes before L alphabetically by party_code
        assert parties == ["C", "C", "L"]

    def test_sort_with_pagination(self, client):
        self._seed_data(client)
        resp = client.get(
            "/api/constituencies?sort_by=name&sort_dir=asc&page=1&page_size=2")
        data = resp.json()
        names = [c["name"] for c in data["constituencies"]]
        assert names == ["Bedford", "Cambridge"]
        assert data["total"] == 3

    def test_default_sort_is_name_asc(self, client):
        self._seed_data(client)
        resp = client.get("/api/constituencies")
        names = [c["name"] for c in resp.json()["constituencies"]]
        assert names == ["Bedford", "Cambridge", "Oxford"]

    def test_invalid_sort_by_rejected(self, client):
        resp = client.get("/api/constituencies?sort_by=invalid")
        assert resp.status_code == 422
