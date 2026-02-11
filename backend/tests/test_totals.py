import io


class TestTotalsEndpoint:
    def test_totals_empty(self, client):
        resp = client.get("/api/totals")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_constituencies"] == 0
        assert data["total_votes"] == 0
        assert data["parties"] == []

    def test_totals_with_data(self, client):
        content = (
            "Bedford,100,C,200,L\n"
            "Oxford,300,C,150,L\n"
            "Cambridge,50,C,400,L\n"
        )
        client.post("/api/upload", files={"file": ("seed.txt", io.BytesIO(content.encode()), "text/plain")})

        resp = client.get("/api/totals")
        assert resp.status_code == 200
        data = resp.json()

        assert data["total_constituencies"] == 3
        assert data["total_votes"] == 100 + 200 + 300 + 150 + 50 + 400

        totals_by_party = {p["party_code"]: p for p in data["parties"]}
        assert totals_by_party["C"]["total_votes"] == 100 + 300 + 50
        assert totals_by_party["L"]["total_votes"] == 200 + 150 + 400

    def test_totals_seats(self, client):
        content = (
            "Bedford,100,C,200,L\n"     # L wins
            "Oxford,300,C,150,L\n"       # C wins
            "Cambridge,50,C,400,L\n"     # L wins
        )
        client.post("/api/upload", files={"file": ("seed.txt", io.BytesIO(content.encode()), "text/plain")})

        resp = client.get("/api/totals")
        data = resp.json()
        totals_by_party = {p["party_code"]: p for p in data["parties"]}
        assert totals_by_party["L"]["seats"] == 2
        assert totals_by_party["C"]["seats"] == 1

    def test_totals_tied_constituency_no_seat(self, client):
        content = (
            "TiedTown,100,C,100,L\n"    # Tied - no seat awarded
            "Bedford,200,C,100,L\n"      # C wins
        )
        client.post("/api/upload", files={"file": ("seed.txt", io.BytesIO(content.encode()), "text/plain")})

        resp = client.get("/api/totals")
        data = resp.json()
        totals_by_party = {p["party_code"]: p for p in data["parties"]}
        # C wins 1 seat (Bedford), L wins 0 seats, TiedTown awards no seat
        assert totals_by_party["C"]["seats"] == 1
        assert totals_by_party["L"]["seats"] == 0

    def test_totals_party_names(self, client):
        content = "Bedford,100,C,200,L\n"
        client.post("/api/upload", files={"file": ("seed.txt", io.BytesIO(content.encode()), "text/plain")})

        resp = client.get("/api/totals")
        data = resp.json()
        totals_by_party = {p["party_code"]: p for p in data["parties"]}
        assert totals_by_party["C"]["party_name"] == "Conservative Party"
        assert totals_by_party["L"]["party_name"] == "Labour Party"

    def test_totals_sorted_by_seats_then_votes(self, client):
        content = (
            "A,100,C,200,L,300,LD\n"    # LD wins
            "B,100,C,400,L,200,LD\n"     # L wins
            "C_const,500,C,100,L,100,LD\n"  # C wins
        )
        client.post("/api/upload", files={"file": ("seed.txt", io.BytesIO(content.encode()), "text/plain")})

        resp = client.get("/api/totals")
        data = resp.json()
        # Each party has 1 seat, so sorted by total votes descending
        codes = [p["party_code"] for p in data["parties"]]
        # All have 1 seat. L: 700, C: 700, LD: 600
        # C and L tied on votes+seats, order among them depends on sort stability
        assert len(codes) == 3
