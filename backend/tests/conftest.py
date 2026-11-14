import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.state import store


@pytest.fixture
def client():
    store.reset()
    with TestClient(create_app()) as c:
        yield c
    store.reset()
