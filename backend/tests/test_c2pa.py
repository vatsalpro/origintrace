import os
import json
import pytest
from pathlib import Path
from PIL import Image
from app.services.c2pa_verifier import C2PAVerifier

@pytest.fixture
def c2pa_verifier():
    return C2PAVerifier()

@pytest.fixture
def plain_image_path(tmp_path):
    img_path = tmp_path / "test_plain.png"
    img = Image.new("RGB", (64, 64), color="blue")
    img.save(img_path)
    return img_path

def test_c2pa_missing_file(c2pa_verifier, tmp_path):
    non_existent = tmp_path / "does_not_exist.jpg"
    res = c2pa_verifier.verify_file(non_existent)
    assert res["has_manifest"] is False
    assert res["status"] == "unavailable"
    assert "File does not exist" in res["error"]

def test_c2pa_image_no_manifest(c2pa_verifier, plain_image_path):
    res = c2pa_verifier.verify_file(plain_image_path)
    assert res["has_manifest"] is False
    assert res["status"] == "no_manifest"
    assert res["sha256"] is not None
    assert len(res["sha256"]) == 64
    # Forensic requirement: images without manifests must NOT be classified as fake or synthetic
    assert "not imply" in res["explanation"].lower() or "not mean" in res["explanation"].lower()
    assert "fake" in res["explanation"].lower() or "synthetic" in res["explanation"].lower()

def test_c2pa_jumbf_manifest_detection(c2pa_verifier, tmp_path):
    # Construct a synthetic file containing JUMBF C2PA markers
    c2pa_file = tmp_path / "synthetic_c2pa.jpg"
    
    # Minimal JPEG header + JUMBF box markers
    jpeg_header = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    
    # Synthetic JUMBF c2pa claim structure
    jumbf_chunk = (
        b"\x00\x00\x00\x80jumb"
        b"\x00\x00\x00\x18jumd"
        b"c2pa"
        b"\x00\x00\x00\x00"
        b"c2cl"
        b'{"claim_generator": "Adobe Photoshop 2024", "title": "Verified Press Photograph", "format": "image/jpeg"}'
        b"c2as"
        b'{"actions": [{"action": "c2pa.created", "softwareAgent": "Leica M11"}]}'
        b"signed: 2024-05-10T14:30:00Z"
    )
    jpeg_footer = b"\xff\xd9"
    
    c2pa_file.write_bytes(jpeg_header + jumbf_chunk + jpeg_footer)
    
    res = c2pa_verifier.verify_file(c2pa_file)
    assert res["has_manifest"] is True
    assert res["status"] in ("verified", "untrusted")
    assert "Adobe Photoshop" in (res.get("claim_generator") or "")
    assert res["sha256"] is not None
    assert "cryptographic_validity_note" in res
    # Disclaimers must distinguish cryptographic validity from real-world truth
    assert "factual" in res["cryptographic_validity_note"].lower() or "truth" in res["cryptographic_validity_note"].lower()

def test_c2pa_ai_generation_marker_flagging(c2pa_verifier, tmp_path):
    ai_c2pa_file = tmp_path / "ai_manifest.jpg"
    
    payload = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        b"\x00\x00\x00\x60jumb"
        b"c2pa"
        b"c2as"
        b'{"actions": [{"action": "c2pa.created", "digitalSourceType": "trainedAlgorithmicMedia"}]}'
        b"claim_generator: Midjourney v6"
        b"\xff\xd9"
    )
    ai_c2pa_file.write_bytes(payload)
    
    res = c2pa_verifier.verify_file(ai_c2pa_file)
    assert res["has_manifest"] is True
    assert res["is_ai_generated"] is True
    assert "Midjourney" in (res.get("claim_generator") or "")
