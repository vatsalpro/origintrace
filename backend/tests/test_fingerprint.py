from PIL import Image
from io import BytesIO
from app.services.fingerprint import extract_image_fingerprints, compare_hashes, analyze_transformation_clues

def test_image_fingerprints():
    img = Image.new("RGB", (100, 100), color="red")
    buf = BytesIO()
    img.save(buf, format="PNG")
    data = buf.getvalue()

    fp = extract_image_fingerprints(data)
    assert len(fp["sha256"]) == 64
    assert fp["perceptual_hash"] is not None
    assert fp["difference_hash"] is not None
    assert fp["image_width"] == 100
    assert fp["image_height"] == 100
    assert fp["image_format"] == "PNG"

def test_compare_hashes_distance():
    h1 = "ffffffffffffffff"
    h2 = "ffffffffffffffff"
    assert compare_hashes(h1, h2) == 0

    h3 = "0000000000000000"
    assert compare_hashes(h1, h3) == 64

def test_transformation_clues():
    clues, meta = analyze_transformation_clues(400, 300, 200, 150, 0, 0)
    assert "Scaled down" in clues or "Identical" in clues or "Perceptually identical" in clues
    assert meta["aspect_ratio_diff"] == 0.0
