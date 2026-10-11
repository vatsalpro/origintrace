import os
import shutil
import re
from io import BytesIO
from typing import Tuple, Dict, Any, List
from PIL import Image, ImageOps, ImageFilter
from app.core.config import settings

def is_tesseract_available() -> Tuple[bool, str]:
    """
    Checks if Tesseract executable is installed and reachable.
    Returns (is_available, executable_path_or_reason).
    """
    cmd = shutil.which(settings.TESSERACT_CMD)
    if cmd:
        return True, cmd

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
                return True, p
            except Exception:
                pass

    return False, "Tesseract executable not found in PATH or standard directories."

def extract_ocr_text(image_bytes: bytes) -> Dict[str, Any]:
    """
    Performs OCR extraction on an image with contrast preprocessing.
    Returns structured result:
    {
        "status": "detected" | "no_text_detected" | "unavailable" | "failed",
        "text": str,
        "confidence": Optional[float],
        "diagnostic_message": str
    }
    """
    try:
        import pytesseract
    except ImportError:
        return {
            "status": "unavailable",
            "text": "",
            "confidence": None,
            "diagnostic_message": "pytesseract Python library is not installed."
        }

    available, path_or_reason = is_tesseract_available()
    if not available:
        return {
            "status": "unavailable",
            "text": "",
            "confidence": None,
            "diagnostic_message": f"Tesseract OCR is not installed on this system ({path_or_reason}). OCR extraction skipped."
        }

    try:
        with Image.open(BytesIO(image_bytes)) as img:
            # Preprocess: convert to grayscale and apply gentle contrast enhancement
            # Avoid harsh binarization that destroys anti-aliased font edges in social screenshots
            gray = img.convert("L")
            enhanced = ImageOps.autocontrast(gray, cutoff=1)
            
            # Subtle sharpen for small font readability
            if min(img.size) < 800:
                enhanced = enhanced.filter(ImageFilter.SHARPEN)

            # Get OCR text and data with confidence
            data = pytesseract.image_to_data(enhanced, output_type=pytesseract.Output.DICT)
            raw_text = pytesseract.image_to_string(enhanced).strip()

            # Calculate average confidence for non-empty text
            confidences = [int(c) for c, w in zip(data.get("conf", []), data.get("text", [])) if str(w).strip() and str(c).isdigit() and int(c) >= 0]
            avg_conf = (sum(confidences) / len(confidences)) if confidences else None

            if raw_text:
                return {
                    "status": "detected",
                    "text": raw_text,
                    "confidence": round(avg_conf, 2) if avg_conf is not None else None,
                    "diagnostic_message": f"Successfully extracted text ({len(raw_text)} chars) with {round(avg_conf, 1) if avg_conf else 0}% confidence."
                }
            else:
                return {
                    "status": "no_text_detected",
                    "text": "",
                    "confidence": None,
                    "diagnostic_message": "No readable text detected in the image."
                }
    except Exception as e:
        return {
            "status": "failed",
            "text": "",
            "confidence": None,
            "diagnostic_message": f"OCR processing failed: {str(e)}"
        }

def generate_ocr_search_queries(ocr_text: str, entities: Dict[str, Any]) -> List[str]:
    """
    Formulates multiple targeted, distinctive search queries from OCR text:
    1. Exact distinctive phrase in quotation marks
    2. Phrase + username handle
    3. Phrase + date/year
    4. Clean distinctive keywords
    """
    if not ocr_text or not ocr_text.strip():
        return []

    queries: List[str] = []
    
    # 1. Distinctive sentences/phrases
    sentences = [s.strip() for s in re.split(r'[.\n!?;]+', ocr_text) if len(s.strip().split()) >= 3]
    for s in sentences[:3]:
        words = s.split()
        if 4 <= len(words) <= 12:
            clean_phrase = " ".join(words)
            queries.append(f'"{clean_phrase}"')
            queries.append(clean_phrase)
        elif len(words) > 12:
            chunk = " ".join(words[:8])
            queries.append(f'"{chunk}"')

    # 2. Handles combined with phrase
    handles = entities.get("handles", [])
    if handles and queries:
        first_q = queries[0].replace('"', '')
        for h in handles[:2]:
            queries.append(f'"{first_q}" @{h}')
            queries.append(f'@{h} {first_q[:30]}')

    # 3. Dates combined with phrase
    dates = entities.get("dates", [])
    if dates and queries:
        first_q = queries[0].replace('"', '')
        for d in dates[:2]:
            queries.append(f'{first_q} {d}')

    # 4. Hashtags
    hashtags = entities.get("hashtags", [])
    for tag in hashtags[:2]:
        queries.append(f'#{tag}')

    # Remove empty or duplicate queries while preserving order
    deduped = list(dict.fromkeys([q.strip() for q in queries if len(q.strip()) >= 4]))
    return deduped[:6]
