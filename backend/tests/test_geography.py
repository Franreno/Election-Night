import io

from app.models.constituency import Constituency
from app.models.region import Region
from tests.conftest import seed_constituencies


class TestGeographyRegions:

    def _seed_regions(self, db_session):
        regions = [
            Region(id=1, name="North East", sort_order=0),
            Region(id=2, name="London", sort_order=6),
            Region(id=3, name="Scotland", sort_order=10),
        ]
        db_session.add_all(regions)
        db_session.commit()

    def test_list_regions_empty(self, client):
        resp = client.get("/api/geography/regions")
        assert resp.status_code == 200
        data = resp.json()
        assert data["regions"] == []

    def test_list_regions_with_data(self, client, db_session):
        self._seed_regions(db_session)
        resp = client.get("/api/geography/regions")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["regions"]) == 3
        # Verify ordered by sort_order
        names = [r["name"] for r in data["regions"]]
        assert names == ["North East", "London", "Scotland"]

    def test_list_regions_constituency_count(self, client, db_session):
        self._seed_regions(db_session)
        seed_constituencies(db_session, ["Bedford", "Oxford"])
        # Upload results
        content = "Bedford,6643,C,5276,L\nOxford,3000,C,8000,L\n"
        client.post("/api/upload",
                    files={
                        "file": ("seed.txt", io.BytesIO(content.encode()),
                                 "text/plain")
                    })
        # Manually assign constituencies to regions
        bedford = db_session.query(Constituency).filter_by(
            name="Bedford").first()
        oxford = db_session.query(Constituency).filter_by(
            name="Oxford").first()
        bedford.region_id = 1  # North East
        oxford.region_id = 2  # London
        db_session.commit()

        resp = client.get("/api/geography/regions")
        data = resp.json()
        counts = {r["name"]: r["constituency_count"] for r in data["regions"]}
        assert counts["North East"] == 1
        assert counts["London"] == 1
        assert counts["Scotland"] == 0

    def test_list_regions_fields(self, client, db_session):
        self._seed_regions(db_session)
        resp = client.get("/api/geography/regions")
        region = resp.json()["regions"][0]
        assert "id" in region
        assert "name" in region
        assert "sort_order" in region
        assert "constituency_count" in region


class TestGeographyRegionDetail:

    def _seed_region_with_constituencies(self, client, db_session):
        region = Region(id=1, name="North East", sort_order=0)
        db_session.add(region)
        db_session.commit()

        seed_constituencies(db_session, ["Bedford", "Oxford"])
        content = "Bedford,6643,C,5276,L\nOxford,3000,C,8000,L\n"
        client.post("/api/upload",
                    files={
                        "file": ("seed.txt", io.BytesIO(content.encode()),
                                 "text/plain")
                    })

        for c in db_session.query(Constituency).all():
            c.region_id = 1
            c.pcon24_code = f"E14001{c.id:03d}"
        db_session.commit()

    def test_region_not_found(self, client):
        resp = client.get("/api/geography/regions/999")
        assert resp.status_code == 404

    def test_region_detail_with_constituencies(self, client, db_session):
        self._seed_region_with_constituencies(client, db_session)
        resp = client.get("/api/geography/regions/1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "North East"
        assert len(data["constituencies"]) == 2
        assert len(data["pcon24_codes"]) == 2

    def test_region_detail_pcon24_codes(self, client, db_session):
        self._seed_region_with_constituencies(client, db_session)
        resp = client.get("/api/geography/regions/1")
        data = resp.json()
        # All pcon24_codes should start with E14
        for code in data["pcon24_codes"]:
            assert code.startswith("E14")

    def test_region_detail_winning_party(self, client, db_session):
        self._seed_region_with_constituencies(client, db_session)
        resp = client.get("/api/geography/regions/1")
        data = resp.json()
        # Bedford: C=6643, L=5276 → winner is C
        # Oxford: C=3000, L=8000 → winner is L
        winners = {
            c["name"]: c["winning_party_code"]
            for c in data["constituencies"]
        }
        assert winners["Bedford"] == "C"
        assert winners["Oxford"] == "L"

    def test_region_detail_constituency_fields(self, client, db_session):
        self._seed_region_with_constituencies(client, db_session)
        resp = client.get("/api/geography/regions/1")
        c = resp.json()["constituencies"][0]
        assert "id" in c
        assert "name" in c
        assert "pcon24_code" in c
        assert "winning_party_code" in c


class TestConstituencyGeographyFields:

    def _seed_with_geography(self, client, db_session):
        region = Region(id=1, name="South East", sort_order=7)
        db_session.add(region)
        db_session.commit()

        seed_constituencies(db_session, ["Bedford"])
        content = "Bedford,6643,C,5276,L\n"
        client.post("/api/upload",
                    files={
                        "file": ("seed.txt", io.BytesIO(content.encode()),
                                 "text/plain")
                    })

        bedford = db_session.query(Constituency).filter_by(
            name="Bedford").first()
        bedford.pcon24_code = "E14001084"
        bedford.region_id = 1
        db_session.commit()

    def test_constituency_detail_includes_geography(self, client, db_session):
        self._seed_with_geography(client, db_session)
        c = db_session.query(Constituency).first()
        resp = client.get(f"/api/constituencies/{c.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["pcon24_code"] == "E14001084"
        assert data["region_name"] == "South East"

    def test_constituency_summary_includes_pcon24(self, client, db_session):
        self._seed_with_geography(client, db_session)
        resp = client.get("/api/constituencies/summary")
        assert resp.status_code == 200
        data = resp.json()
        c = data["constituencies"][0]
        assert c["pcon24_code"] == "E14001084"

    def test_constituency_without_geography(self, client, db_session):
        seed_constituencies(db_session, ["Bedford"])
        content = "Bedford,6643,C,5276,L\n"
        client.post("/api/upload",
                    files={
                        "file": ("seed.txt", io.BytesIO(content.encode()),
                                 "text/plain")
                    })
        resp = client.get("/api/constituencies/summary")
        data = resp.json()
        c = data["constituencies"][0]
        assert c["pcon24_code"] is None
