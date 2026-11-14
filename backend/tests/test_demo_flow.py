"""Acceptance B-5 / P-1..P-5: the primary demo flow, with every outbound network connection refused."""
import socket

import pytest

from tests.contract import assert_matches
from tests.helpers import add_preset, options


@pytest.fixture
def offline(monkeypatch):
    def refuse(*a, **k):
        raise OSError("network disabled for this test")
    monkeypatch.setattr(socket.socket, "connect", refuse)
    monkeypatch.setattr(socket, "create_connection", refuse)


def test_primary_demo_flow_offline(client, offline):
    b = client.get("/api/board").json()                                  # 1 normal day
    assert b["indicators"]["normal"] == b["indicators"]["changed"]
    b, did = add_preset(client, "close60")                               # 2 closure
    assert b["pending_verification_ids"] == [did]
    hit = b["disruptions"][-1]["affected_shipment_ids"]
    b = client.patch(f"/api/disruptions/{did}", json={"verification": "dismissed"}).json()   # 3 dismiss
    assert b["indicators"]["changed"] == b["indicators"]["normal"]
    b = client.patch(f"/api/disruptions/{did}", json={"verification": "confirmed"}).json()   # undo, confirm
    at_risk = [s["id"] for s in b["shipments"] if s["attention"] == "act"]
    assert at_risk and set(at_risk) <= set(hit)
    o = options(client, at_risk[0])                                      # 4 options
    assert len(o["options"]) >= 3
    other = next(x for x in o["options"] if x["feasible"] and not x["suggested"] and x["kind"] != "keep")
    r = client.post("/api/decisions", json={"shipment_id": at_risk[0], "option_id": other["id"],
                                            "reason": "Dispatcher override for the demo"})   # 5 override
    assert r.status_code == 201
    res = r.json()
    assert_matches("DecisionResult", res)
    ind = res["board"]["indicators"]                                     # 6 three columns
    assert ind["decided"] != ind["changed"]
    assert res["decision"]["supervisor_update"]
    m = client.get("/api/method").json()                                 # 7 method
    assert m["assumptions"] and m["formulas"]
    assert client.delete(f"/api/decisions/{res['decision']['id']}").status_code == 200
