import os
import shutil
from io import BytesIO
from typing import Tuple
from PIL import Image, ImageOps, ImageFilter
from app.core.config import settings

def is_tesseract_available() -> bool:
    """Checks if Tesseract executable is installed and reachable."""
    if shutil.which(settings.TESSERACT_CMD):
        return True
    # Common Windows install paths check
    win_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Tesseract-OCR\tesseract.exe"),
    ]
    for p in win_paths:
        if os.path.isfile(p):
            try:
                import pytesseract
                pytesseract.pytesseract.tesseract_cmd = p
                return True
            except Exception:
                pass
    return False

def extract_ocr_text(image_bytes: bytes) -> Tuple[bool, str, str]:
    """
    Performs OCR extraction on an image with contrast preprocessing.
    Returns (success, extracted_text, diagnostic_message).
    """
    try:
        import pytesseract
    except ImportError:
        return False, "", "pytesseract library not available"

    if not is_tesseract_available():
        return False, "", "Tesseract OCR binary is not installed or not in system PATH. OCR extraction skipped."

    try:
        with Image.open(BytesIO(image_bytes)) as img:
            # Preprocess: convert to grayscale and enhance contrast for screenshot readability
            gray = img.convert("L")
            enhanced = ImageOps.autocontrast(gray)
            
            # Optional sharpen for small text in social media screenshots
            sharpened = enhanced.filter(ImageFilter.SHARPEN)

            text = pytesseract.image_to_string(sharpened)
            cleaned_text = text.strip()
            return True, cleaned_text, "OCR extraction succeeded"
    except Exception as e:
        return False, "", f"OCR processing error: {str(e)}"
