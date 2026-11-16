import os
import tempfile

import pytest
from fastapi.testclient import TestClient

_runtime = tempfile.TemporaryDirectory(prefix="document-tests-", dir="/Volumes/quocDisk/AI/sam3/tmp")
os.environ["SAM3_RUNTIME_DIR"] = _runtime.name


@pytest.fixture(scope="session")
def client():
    from sam3_service.app import app
    with TestClient(app) as instance:
        yield instance
