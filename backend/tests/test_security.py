from app.core.security import validate_public_url, is_ip_blocked, validate_image_file_bytes
from PIL import Image
from io import BytesIO

def test_blocked_private_ips():
    assert is_ip_blocked("127.0.0.1") is True
    assert is_ip_blocked("10.0.0.1") is True
    assert is_ip_blocked("192.168.1.1") is True
    assert is_ip_blocked("172.16.0.5") is True
    assert is_ip_blocked("169.254.169.254") is True
    assert is_ip_blocked("::1") is True

def test_validate_public_url():
    # Disallowed schemes
    ok, _ = validate_public_url("file:///etc/passwd")
    assert ok is False
    ok, _ = validate_public_url("gopher://localhost:70")
    assert ok is False

    # Blocked hosts
    ok, _ = validate_public_url("http://localhost:8000")
    assert ok is False
    ok, _ = validate_public_url("http://127.0.0.1:8080/admin")
    assert ok is False

    # Valid public host
    ok, _ = validate_public_url("https://web.archive.org")
    assert ok is True

def test_validate_image_file_bytes():
    # Corrupted / invalid data
    ok, _, _ = validate_image_file_bytes(b"not an image file")
    assert ok is False

    # Valid image data
    img = Image.new("RGB", (50, 50), color="blue")
    buf = BytesIO()
    img.save(buf, format="PNG")
    ok, fmt, _ = validate_image_file_bytes(buf.getvalue())
    assert ok is True
    assert fmt == "png"
