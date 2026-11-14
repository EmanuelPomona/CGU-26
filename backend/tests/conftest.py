import pytest
from fastapi.testclient import TestClient

from app import feeds
from app.main import create_app
from app.state import store


@pytest.fixture
def client():
    store.reset()
    with TestClient(create_app()) as c:
        yield c
    store.reset()


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Tests never touch the network: feed fetches fail unless a test installs recorded payloads."""
    def refuse(url, timeout):
        raise OSError("network disabled in tests")
    monkeypatch.setattr(feeds, "FETCH", refuse)
    feeds.clear_cache()
    yield
    feeds.clear_cache()
