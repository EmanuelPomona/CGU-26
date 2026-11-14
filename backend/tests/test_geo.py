"""Geometry primitives. Expected values are hand-computed in the comments."""
import math

import pytest

from app.engine import geo


def test_haversine_one_degree_of_longitude_on_equator():
    # 2 * 6371000 * asin(sin(0.5 deg)) = 6371000 * pi / 180 = 111194.93 m
    assert geo.hav((0.0, 0.0), (0.0, 1.0)) == pytest.approx(111194.93, abs=0.05)


def test_haversine_zero_for_same_point():
    assert geo.hav((34.0, -118.0), (34.0, -118.0)) == 0


def test_point_to_segment_perpendicular():
    # equirectangular, 111320 m per degree of latitude: 1 degree north of the segment
    assert geo.dist_pt_seg((1.0, 0.0), (0.0, -1.0), (0.0, 1.0)) == pytest.approx(111320.0)


def test_point_to_segment_clamps_to_endpoint():
    # beyond the east end: distance to the endpoint (0,1), 1 deg lng at equator = 111320 m
    assert geo.dist_pt_seg((0.0, 2.0), (0.0, 0.0), (0.0, 1.0)) == pytest.approx(111320.0)


def test_point_on_segment_is_zero():
    assert geo.dist_pt_seg((0.0, 0.5), (0.0, 0.0), (0.0, 1.0)) == pytest.approx(0.0)


def test_phi_matches_normal_cdf():
    assert geo.phi(0) == pytest.approx(0.5, abs=1e-6)
    assert geo.phi(1.96) == pytest.approx(0.975, abs=1e-4)
    assert geo.phi(-1.96) == pytest.approx(0.025, abs=1e-4)


def test_traffic_multiplier_peak_at_0730():
    # both Gaussians: peak at 7.5 h -> 1 + 0.05 + 0.35 * 1 = 1.40
    assert geo.traffic_mult(450) == pytest.approx(1.40, abs=1e-9)


def test_traffic_multiplier_midday_is_near_free_flow():
    # 12:00 -> exp(-(4.5/1.3)^2)=6.3e-6, exp(-(5/1.5)^2)=1.5e-5 -> 1.05 + 0.35*1.5e-5
    assert geo.traffic_mult(720) == pytest.approx(1.05, abs=1e-4)


def _straight_route():
    a, b = (34.0, -118.0), (34.0, -117.9)
    d = geo.hav(a, b)
    return geo.prepare_route({
        "id": "X-Y-0", "pair": "X>Y", "label": "test", "via": None, "distance_mi": d / 1609.344,
        "base_minutes": 10.0, "estimated": False, "geometry": [list(a), list(b)],
        "steps": [{"geometry": [list(a), list(b)], "distance_m": d, "duration_s": 600.0, "highway": True}],
    })


def test_exposure_counts_chord_inside_circle():
    rt = _straight_route()
    d = rt.steps[0].distance_m
    ex = geo.exposure(rt, 34.0, -117.95, 1.0)
    assert ex.hit
    # a line through the centre of a 1 km circle is inside for 2 km
    assert ex.meters == pytest.approx(2000.0, rel=0.01)
    assert ex.seconds == pytest.approx(600.0 * 2000.0 / d, rel=0.01)


def test_exposure_misses_far_circle():
    ex = geo.exposure(_straight_route(), 34.2, -117.95, 1.0)
    assert not ex.hit and ex.meters == 0 and ex.seconds == 0


def test_exposure_circle_containing_whole_route():
    rt = _straight_route()
    ex = geo.exposure(rt, 34.0, -117.95, 15.0)
    assert ex.meters == pytest.approx(rt.steps[0].distance_m, rel=1e-6)
    assert ex.seconds == pytest.approx(600.0, rel=1e-6)
