"""Validate real payloads against components.schemas of docs/openapi.yaml (JSON Schema 2020-12)."""
from __future__ import annotations

from functools import cache, lru_cache
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

SPEC = Path(__file__).resolve().parents[2] / "docs" / "openapi.yaml"


@lru_cache(maxsize=1)
def _spec() -> dict:
    return yaml.safe_load(SPEC.read_text())


@cache
def _validator(schema_name: str) -> Draft202012Validator:
    spec = _spec()
    if schema_name not in spec["components"]["schemas"]:
        raise KeyError(f"no schema {schema_name!r} in {SPEC}")
    # Only local '#/components/...' refs are resolvable: the document carries its own components.
    schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$ref": f"#/components/schemas/{schema_name}",
        "components": spec["components"],
    }
    return Draft202012Validator(schema)


def assert_matches(schema_name: str, payload) -> None:
    errors = sorted(_validator(schema_name).iter_errors(payload), key=lambda e: list(e.absolute_path))
    if errors:
        lines = [f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message[:200]}" for e in errors[:10]]
        raise AssertionError(f"{schema_name} violates the contract ({len(errors)} error(s)):\n" + "\n".join(lines))


def assert_inline(schema: dict, payload) -> None:
    """Validate against an inline response schema (for endpoints without a named schema)."""
    full = {"$schema": "https://json-schema.org/draft/2020-12/schema", **schema, "components": _spec()["components"]}
    errors = list(Draft202012Validator(full).iter_errors(payload))
    assert not errors, [e.message[:200] for e in errors[:10]]


def response_schema(path: str, method: str, status: str = "200") -> dict:
    return _spec()["paths"][path][method]["responses"][status]["content"]["application/json"]["schema"]
