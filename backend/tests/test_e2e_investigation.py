import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app

def _create_sample_png() -> bytes:
    img = Image.new("RGB", (100, 100), color=(80, 120, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def test_e2e_image_investigation_lifecycle():
    client = TestClient(app)
    
    # 1. Check health
    health_res = client.get("/api/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "healthy"
    
    # 2. Check connectors list
    conn_res = client.get("/api/connectors")
    assert conn_res.status_code == 200
    connectors = conn_res.json()
    names = [c["name"] for c in connectors]
    assert "reverse_image" in names
    assert "wayback" in names
    assert "bluesky" in names
    assert "mastodon" in names
    
    # 3. Create image investigation
    png_bytes = _create_sample_png()
    files = {"file": ("test_image.png", png_bytes, "image/png")}
    data = {
        "title": "Automated E2E Forensic Test Case",
        "input_type": "image",
        "selected_platforms": '["wayback", "reverse_image"]'
    }
    from unittest.mock import patch, AsyncMock
    from app.connectors.base import ConnectorResult

    with patch("app.connectors.reverse_image.ReverseImageConnector.search_image", new_callable=AsyncMock) as mock_rev, \
         patch("app.connectors.wayback.WaybackConnector.query_url_captures", new_callable=AsyncMock) as mock_wb:
        mock_rev.return_value = ConnectorResult(
            connector_name="reverse_image",
            status="completed_no_matches",
            records=[],
            coverage_notes="Mocked e2e test",
            credits_consumed=0
        )
        mock_wb.return_value = ConnectorResult(
            connector_name="wayback",
            status="completed_no_matches",
            records=[],
            coverage_notes="Mocked e2e test"
        )
        create_res = client.post("/api/investigations", data=data, files=files)
    assert create_res.status_code == 200
    inv = create_res.json()
    inv_id = inv["id"]
    assert inv_id.startswith("INV-")
    assert len(inv["assets"]) == 1
    asset = inv["assets"][0]
    assert asset["sha256"] is not None
    assert asset["perceptual_hash"] is not None
    assert asset["image_width"] == 100
    assert asset["image_height"] == 100
    
    # 4. Check stages endpoint
    stages_res = client.get(f"/api/investigations/{inv_id}/stages")
    assert stages_res.status_code == 200
    stage_data = stages_res.json()
    assert stage_data["investigation_id"] == inv_id
    assert "intake" in stage_data["stages"]
    
    # 5. Check diagnostics endpoint
    diag_res = client.get(f"/api/investigations/{inv_id}/diagnostics")
    assert diag_res.status_code == 200
    diag = diag_res.json()
    assert diag["investigation_id"] == inv_id
    assert "connectors_attempted" in diag
    assert "reasons_for_limited_results" in diag
    
    # 6. Check asset file endpoint
    asset_id = asset["id"]
    file_res = client.get(f"/api/investigations/{inv_id}/asset/{asset_id}/file")
    assert file_res.status_code == 200
    assert file_res.headers["content-type"].startswith("image/")
    
    # 7. Check timeline endpoint
    timeline_res = client.get(f"/api/investigations/{inv_id}/timeline")
    assert timeline_res.status_code == 200
    
    # 8. Check graph endpoint
    graph_res = client.get(f"/api/investigations/{inv_id}/graph")
    assert graph_res.status_code == 200
    assert "nodes" in graph_res.json()
    assert "edges" in graph_res.json()
