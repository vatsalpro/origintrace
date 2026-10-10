import hashlib
from io import BytesIO
from typing import Dict, Any, Tuple, Optional
from PIL import Image, ExifTags
import imagehash

def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def extract_exif_metadata(img: Image.Image) -> Dict[str, Any]:
    exif_data = {}
    try:
        raw_exif = img.getexif()
        if raw_exif:
            for tag_id, value in raw_exif.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                # Only keep clean serializable values
                if isinstance(value, (str, int, float)):
                    exif_data[tag_name] = value
                elif isinstance(value, bytes):
                    exif_data[tag_name] = value.hex()[:64]
                else:
                    exif_data[tag_name] = str(value)[:128]
    except Exception:
        pass
    return exif_data

def extract_image_fingerprints(image_bytes: bytes) -> Dict[str, Any]:
    """
    Extracts multi-algorithm cryptographic and perceptual fingerprints from image bytes.
    SHA-256 for exact bitstream identity.
    pHash, dHash, aHash, wHash for perceptual, gradient, and frequency comparison.
    """
    sha256_hash = compute_sha256(image_bytes)

    with Image.open(BytesIO(image_bytes)) as img:
        width, height = img.size
        img_format = (img.format or "UNKNOWN").upper()
        
        # Convert to RGB for hashing to avoid palette/alpha issues
        rgb_img = img.convert("RGB")
        
        phash_val = str(imagehash.phash(rgb_img))
        dhash_val = str(imagehash.dhash(rgb_img))
        ahash_val = str(imagehash.average_hash(rgb_img))
        
        try:
            whash_val = str(imagehash.whash(rgb_img))
        except Exception:
            whash_val = None

        exif = extract_exif_metadata(img)

    return {
        "sha256": sha256_hash,
        "perceptual_hash": phash_val,
        "difference_hash": dhash_val,
        "average_hash": ahash_val,
        "wavelet_hash": whash_val,
        "image_width": width,
        "image_height": height,
        "image_format": img_format,
        "exif_data": exif,
    }

def compare_hashes(hash1_str: Optional[str], hash2_str: Optional[str]) -> Optional[int]:
    """Computes Hamming distance between two hex hash strings. Lower is more similar."""
    if not hash1_str or not hash2_str:
        return None
    try:
        h1 = imagehash.hex_to_hash(hash1_str)
        h2 = imagehash.hex_to_hash(hash2_str)
        return int(h1 - h2)
    except Exception:
        return None

def analyze_transformation_clues(
    orig_w: Optional[int], orig_h: Optional[int],
    cand_w: Optional[int], cand_h: Optional[int],
    phash_dist: Optional[int], dhash_dist: Optional[int]
) -> Tuple[str, Dict[str, Any]]:
    """
    Analyzes visual transformation clues (resizing, aspect ratio crop, recompression).
    """
    clues = []
    metadata = {}

    if orig_w and orig_h and cand_w and cand_h:
        orig_ratio = orig_w / orig_h
        cand_ratio = cand_w / cand_h
        ratio_diff = abs(orig_ratio - cand_ratio)
        metadata["orig_dimensions"] = f"{orig_w}x{orig_h}"
        metadata["cand_dimensions"] = f"{cand_w}x{cand_h}"
        metadata["aspect_ratio_diff"] = round(ratio_diff, 4)

        if orig_w == cand_w and orig_h == cand_h:
            clues.append("Identical dimensions")
        elif ratio_diff < 0.05:
            if cand_w < orig_w:
                clues.append("Scaled down / recompressed")
            else:
                clues.append("Scaled up")
        else:
            clues.append("Altered aspect ratio / cropped / bordered")

    if phash_dist is not None:
        if phash_dist == 0:
            clues.append("Perceptually identical")
        elif phash_dist <= 6:
            clues.append("Strong visual match with minor artifacts or noise")
        elif phash_dist <= 12:
            clues.append("Moderate similarity with compression or cropping")
        else:
            clues.append("High visual distance")

    summary = "; ".join(clues) if clues else "Standard visual comparison"
    return summary, metadata
