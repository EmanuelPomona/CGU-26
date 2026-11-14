from tests.helpers import add_preset, options

ECO = {"reliability": 0, "cost": 0, "emissions": 100, "community": 0, "driver": 0}


def test_emissions_only_weights_pick_lowest_co2_feasible(client):
    add_preset(client, "close60", "confirmed")
    client.put("/api/settings", json={"clock_min": 480, "weights": ECO})
    for sid in ["C-103", "C-107"]:
        o = options(client, sid)
        assert o["weights"] == ECO
        feas = [x for x in o["options"] if x["feasible"]]
        best = min(feas, key=lambda x: x["evaluation"]["co2_kg"])
        assert o["suggested_option_id"] is not None
        sug = next(x for x in o["options"] if x["suggested"])
        assert sug["evaluation"]["co2_kg"] == best["evaluation"]["co2_kg"]


def test_rationale_names_weights(client):
    add_preset(client, "close60", "confirmed")
    r = options(client, "C-103")["rationale"]
    assert "reliability 35" in r and "emissions 20" in r


def test_all_infeasible_gives_no_suggestion_and_escalation(client):
    from app.engine.scoring import pick_suggestion

    opts = [{"id": "keep", "feasible": False, "score": 10.0}, {"id": "x", "feasible": False, "score": 50.0}]
    sid, rationale = pick_suggestion(opts, {"reliability": 35, "cost": 20, "emissions": 20, "community": 15, "driver": 10}, [])
    assert sid is None
    assert "no feasible response was found" in rationale.lower() and "escalate" in rationale.lower()


def test_infeasible_never_suggested_even_with_top_score():
    from app.engine.scoring import pick_suggestion

    opts = [{"id": "keep", "feasible": True, "score": 10.0}, {"id": "x", "feasible": False, "score": 99.0}]
    sid, _ = pick_suggestion(opts, {"reliability": 1, "cost": 0, "emissions": 0, "community": 0, "driver": 0},
                             [{"id": "keep", "title": "Keep the plan"}])
    assert sid == "keep"


def test_norm_scores_equal_values_get_100():
    from app.engine.scoring import norm

    assert norm(5.0, [5.0, 5.0]) == 100
    assert norm(1.0, [1.0, 3.0]) == 100 and norm(3.0, [1.0, 3.0]) == 0
