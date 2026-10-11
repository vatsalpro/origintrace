import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.database.session import SessionLocal, engine
from app.models.entities import Investigation

client = TestClient(app)

@pytest.fixture(autouse=True)
def cleanup_incognito():
    # Clear any active incognito session before and after each test
    client.post("/api/investigations/incognito/clear")
    yield
    client.post("/api/investigations/incognito/clear")

def test_incognito_never_persists_to_disk_database():
    """
    CRITICAL PRIVACY TEST:
    Verifies that an incognito investigation is stored ONLY in RAM (in-memory SQLite)
    and NEVER reaches the persistent disk database engine or tables.
    """
    with patch("app.api.investigations.run_investigation_pipeline", new_callable=AsyncMock):
        res = client.post("/api/investigations", data={
            "title": "Confidential Whistleblower Query",
            "input_type": "text",
            "input_content": "Sensitive unrecorded claim about upcoming investigation",
            "is_incognito": "true"
        })
    assert res.status_code == 200
    incognito_data = res.json()
    incognito_id = incognito_data["id"]
    assert incognito_data["is_incognito"] is True
    assert incognito_id.startswith("INV-INC-")

    # 1. Verify via SQLAlchemy persistent SessionLocal
    db_persistent = SessionLocal()
    try:
        found_orm = db_persistent.query(Investigation).filter(Investigation.id == incognito_id).first()
        assert found_orm is None, "CRITICAL FAILURE: Incognito investigation was persisted in disk DB ORM!"
    finally:
        db_persistent.close()

    # 2. Verify via raw SQL on persistent engine
    with engine.connect() as conn:
        result = conn.execute(text("SELECT count(*) FROM investigations WHERE id = :id"), {"id": incognito_id})
        count = result.scalar()
        assert count == 0, "CRITICAL FAILURE: Raw SQL query found incognito investigation in persistent tables!"

def test_incognito_excluded_from_normal_history_list():
    """
    Verifies that normal history endpoints (/api/investigations) strictly exclude
    incognito investigations, while retaining normal recorded investigations.
    """
    with patch("app.api.investigations.run_investigation_pipeline", new_callable=AsyncMock):
        # Create normal investigation
        res_normal = client.post("/api/investigations", data={
            "title": "Public Case Record",
            "input_type": "text",
            "input_content": "Public article reference",
            "is_incognito": "false"
        })
        assert res_normal.status_code == 200
        normal_id = res_normal.json()["id"]

        # Create incognito investigation
        res_incog = client.post("/api/investigations", data={
            "title": "Private Incognito Trace",
            "input_type": "text",
            "input_content": "Ephemeral trace inquiry",
            "is_incognito": "true"
        })
        assert res_incog.status_code == 200
        incog_id = res_incog.json()["id"]

    # Check normal history list
    res_list = client.get("/api/investigations")
    assert res_list.status_code == 200
    history_ids = [inv["id"] for inv in res_list.json()]

    assert normal_id in history_ids, "Normal investigation must appear in history"
    assert incog_id not in history_ids, "Incognito investigation must NOT appear in normal history list"

def test_incognito_in_memory_retrieval_and_status():
    """
    Verifies that direct ID endpoints (/status, /stages, /timeline, etc.) work for the active
    incognito case from RAM while the session remains active.
    """
    with patch("app.api.investigations.run_investigation_pipeline", new_callable=AsyncMock):
        res = client.post("/api/investigations", data={
            "title": "In-Memory Test Investigation",
            "input_type": "text",
            "input_content": "Analyzing test text snippet",
            "is_incognito": "true"
        })
    incog_id = res.json()["id"]

    # Direct retrieval
    get_res = client.get(f"/api/investigations/{incog_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == incog_id
    assert get_res.json()["is_incognito"] is True

    # Status endpoint
    status_res = client.get(f"/api/investigations/{incog_id}/status")
    assert status_res.status_code == 200
    assert status_res.json()["is_incognito"] is True

    # Stages endpoint
    stages_res = client.get(f"/api/investigations/{incog_id}/stages")
    assert stages_res.status_code == 200
    assert stages_res.json()["investigation_id"] == incog_id

    # Timeline endpoint
    timeline_res = client.get(f"/api/investigations/{incog_id}/timeline")
    assert timeline_res.status_code == 200

def test_incognito_clear_session_purges_memory_and_files():
    """
    Verifies that calling /api/investigations/incognito/clear permanently erases
    all in-memory records and ensures subsequent access returns 404 Not Found.
    """
    with patch("app.api.investigations.run_investigation_pipeline", new_callable=AsyncMock):
        res = client.post("/api/investigations", data={
            "title": "Temporary Session Investigation",
            "input_type": "text",
            "input_content": "Temporary probe",
            "is_incognito": "true"
        })
    incog_id = res.json()["id"]

    # Verify active status
    status_check = client.get("/api/investigations/incognito/status")
    assert status_check.status_code == 200
    assert status_check.json()["active_cases_count"] >= 1

    # Clear incognito session
    clear_res = client.post("/api/investigations/incognito/clear")
    assert clear_res.status_code == 200
    assert clear_res.json()["status"] == "cleared"

    # Status check confirms 0 active cases
    status_after = client.get("/api/investigations/incognito/status")
    assert status_after.json()["active_cases_count"] == 0

    # Direct retrieval now returns 404
    assert client.get(f"/api/investigations/{incog_id}").status_code == 404

def test_incognito_delete_individual_case():
    """
    Verifies that deleting a specific incognito case purges it from memory immediately.
    """
    with patch("app.api.investigations.run_investigation_pipeline", new_callable=AsyncMock):
        res = client.post("/api/investigations", data={
            "title": "Individual Incognito Deletion",
            "input_type": "text",
            "input_content": "Testing delete endpoint",
            "is_incognito": "true"
        })
    incog_id = res.json()["id"]

    del_res = client.delete(f"/api/investigations/{incog_id}")
    assert del_res.status_code == 200
    assert client.get(f"/api/investigations/{incog_id}").status_code == 404

def test_error_handling_never_falls_back_to_disk_storage():
    """
    Verifies that validation failures or exceptions on incognito requests
    never silently fall back to persistent storage.
    """
    # 1. Unsafe URL rejection
    res_unsafe = client.post("/api/investigations", data={
        "title": "Unsafe Internal Host Probe",
        "input_type": "url",
        "input_content": "http://192.168.1.1/admin-secret",
        "is_incognito": "true"
    })
    assert res_unsafe.status_code == 400
    assert "Invalid or unsafe URL" in res_unsafe.json()["detail"]

    # 2. Verify nothing was added to persistent DB
    db_persistent = SessionLocal()
    try:
        found = db_persistent.query(Investigation).filter(Investigation.title == "Unsafe Internal Host Probe").first()
        assert found is None, "Failed request must never write fallback records to disk database"
    finally:
        db_persistent.close()

def test_switching_modes_leaves_normal_data_unmerged():
    """
    Verifies that switching from normal mode to incognito mode and back leaves
    existing persistent investigations intact, and does not merge incognito data.
    """
    with patch("app.api.investigations.run_investigation_pipeline", new_callable=AsyncMock):
        # 1. Normal mode investigation created
        res1 = client.post("/api/investigations", data={
            "title": "Permanent Normal Investigation",
            "input_type": "text",
            "input_content": "Persistent record A",
            "is_incognito": "false"
        })
        norm_id = res1.json()["id"]

        # 2. Incognito investigation created in temporary session
        res2 = client.post("/api/investigations", data={
            "title": "Ephemeral Session Investigation",
            "input_type": "text",
            "input_content": "Ephemeral record B",
            "is_incognito": "true"
        })
        incog_id = res2.json()["id"]

        # 3. Clear incognito session (simulating exit from Incognito Mode)
        client.post("/api/investigations/incognito/clear")

    # 4. Check persistent investigations
    res_list = client.get("/api/investigations")
    all_ids = [inv["id"] for inv in res_list.json()]
    assert norm_id in all_ids, "Normal investigation must remain intact"
    assert incog_id not in all_ids, "Incognito investigation must NEVER be merged into persistent history"
