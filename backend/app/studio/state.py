"""In-memory Route studio sessions."""
from __future__ import annotations

from typing import Any

_sessions: dict[str, dict[str, Any]] = {}


def get(sid: str) -> dict[str, Any] | None:
    return _sessions.get(sid)


def put(sid: str, session: dict[str, Any]) -> dict[str, Any]:
    _sessions[sid] = session
    return session


def delete(sid: str) -> None:
    _sessions.pop(sid, None)


def reset() -> None:
    _sessions.clear()
