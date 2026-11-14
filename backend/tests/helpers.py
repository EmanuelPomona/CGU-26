def presets(client):
    return {p["id"]: p["disruption"] for p in client.get("/api/presets").json()["presets"]}


def add_preset(client, pid, verification=None):
    b = client.post("/api/disruptions", json=presets(client)[pid]).json()
    did = b["disruptions"][-1]["id"]
    if verification:
        b = client.patch(f"/api/disruptions/{did}", json={"verification": verification}).json()
    return b, did


def options(client, sid):
    r = client.get(f"/api/shipments/{sid}/options")
    assert r.status_code == 200, r.text
    return r.json()
