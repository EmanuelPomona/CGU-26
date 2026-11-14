"""Model constants. Every value is a simulated assumption; /api/method serves them all."""
from __future__ import annotations

MI = 1609.344

GATE_MIN = 40.0
UNLOAD_MIN = 45.0
BLOCK_PENALTY_MIN = 150.0
NO_TRUCK_LATE_MIN = 180.0
DETENTION_USD_PER_MIN = 1.20
USD_PER_MILE = 2.10
DRIVER_USD_PER_HOUR = 38.0
CO2_LOADED_KG_PER_MI = 1.75
CO2_EMPTY_KG_PER_MI = 1.30
CO2_IDLE_KG_PER_MIN = 0.136
CONGESTION_CO2_EXTRA = 0.30
DEADHEAD_MPH = 28.0
CIRCUITY = 1.35
RESCHEDULE_FEE_USD = 75.0
SENSITIVE_RADIUS_M = 250.0
DOCK_QUEUE_MIN_PER_CUT = 90.0
RETURN_TIME_FACTOR = 0.9
SIGMA_BASE_MIN = 6.0
SIGMA_PER_DRIVE_MIN = 0.12
AT_RISK_PROBABILITY = 0.5
TIGHT_PROBABILITY = 0.85
TIGHT_SLACK_MIN = 15.0
ADDED_MILES_REVIEW_MI = 20.0
NIGHT_MULTIPLIER = 1.5
LOCAL_MILE_PENALTY = 1.5
LOCAL_PENALTY_CAP = 30.0
PLACES_PENALTY_CAP = 50.0
IDLE_BURDEN_MIN = 20.0

W_LOCAL = {"school": 6.0, "hospital": 8.0, "residential": 3.0}
W_HWY = {"school": 1.0, "hospital": 1.5, "residential": 0.5}

DEFAULT_CLOCK_MIN = 480
DEFAULT_WEIGHTS = {"reliability": 35, "cost": 20, "emissions": 20, "community": 15, "driver": 10}

# (key, label, value, unit, note) — served by /api/method, kind "simulated"
ASSUMPTIONS = [
    ("gate_min", "Terminal gate and pickup time", GATE_MIN, "min", "Time from container pickup to leaving the terminal."),
    ("unload_min", "Unload time at warehouse", UNLOAD_MIN, "min", "Counted in driver hours."),
    ("block_penalty_min", "Closure or hazard penalty", BLOCK_PENALTY_MIN, "min", "Assumed wait or detour when a route is blocked, weighted by the report's probability."),
    ("no_truck_late_min", "Lateness when no truck is available", NO_TRUCK_LATE_MIN, "min", "Placeholder lateness until a truck is found."),
    ("detention_usd_per_min", "Detention charge", DETENTION_USD_PER_MIN, "USD/min late", "Applied to every late minute."),
    ("usd_per_mile", "Operating cost per mile", USD_PER_MILE, "USD/mi", "Fuel, tires, maintenance."),
    ("driver_usd_per_hour", "Driver cost", DRIVER_USD_PER_HOUR, "USD/h", "Applied to all duty hours."),
    ("co2_loaded", "CO2 per loaded mile", CO2_LOADED_KG_PER_MI, "kg/mi", "Diesel drayage tractor estimate."),
    ("co2_empty", "CO2 per empty mile", CO2_EMPTY_KG_PER_MI, "kg/mi", "Deadhead and return legs."),
    ("co2_idle", "CO2 per idle minute", CO2_IDLE_KG_PER_MIN, "kg/min", "Waiting at terminal or in a dock queue."),
    ("congestion_co2_extra", "Extra CO2 on congested miles", CONGESTION_CO2_EXTRA * 100, "%", "Stop-and-go penalty on miles in peak traffic or a slowdown."),
    ("deadhead_mph", "Deadhead speed", DEADHEAD_MPH, "mph", "Truck to terminal, empty."),
    ("circuity", "Straight-line circuity factor", CIRCUITY, "x", "Road miles per straight-line mile, for deadhead and estimated routes."),
    ("reschedule_fee_usd", "Appointment change fee", RESCHEDULE_FEE_USD, "USD", "Charged when the warehouse slot moves."),
    ("sensitive_radius_m", "Sensitive-place radius", SENSITIVE_RADIUS_M, "m", "Schools, hospitals, homes this close to a route count against the community score."),
    ("dock_queue_min", "Dock queue per share of docks lost", DOCK_QUEUE_MIN_PER_CUT, "min", "Queue = 90 x fraction of docks lost."),
    ("sigma_base_min", "Arrival uncertainty, base", SIGMA_BASE_MIN, "min", "Sigma = 6 + 0.12 x drive minutes."),
    ("sigma_per_drive_min", "Arrival uncertainty per drive minute", SIGMA_PER_DRIVE_MIN, "min/min", "Longer drives are less certain."),
    ("at_risk_probability", "At-risk threshold", AT_RISK_PROBABILITY, "probability", "On-time probability below this is at risk."),
    ("tight_probability", "Tight threshold", TIGHT_PROBABILITY, "probability", "Below this (or under 15 min slack) is tight."),
    ("tight_slack_min", "Tight slack threshold", TIGHT_SLACK_MIN, "min", "Less slack than this is tight."),
    ("added_miles_review_mi", "Added-miles review threshold", ADDED_MILES_REVIEW_MI, "mi", "Example threshold from the organizer workshop, not an operating standard."),
    ("night_multiplier", "Night-time community multiplier", NIGHT_MULTIPLIER, "x", "Applied between 8:00 PM and 6:00 AM."),
    ("local_mile_penalty", "Community penalty per local-street mile", LOCAL_MILE_PENALTY, "points/mi", "Capped at 30 points."),
    ("return_time_factor", "Return trip time factor", RETURN_TIME_FACTOR, "x", "Empty return takes 0.9 x the loaded base drive time."),
]
