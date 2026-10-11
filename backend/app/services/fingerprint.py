import hashlib
from io import BytesIO
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
from PIL import Image, ExifTags, ImageOps
import imagehash
from app.core.config import settings

def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def _convert_gps_coordinate(coords, ref) -> Optional[float]:
    """Converts EXIF GPS coordinate tuple (degrees, minutes, seconds) to decimal float."""
    try:
        degrees = float(coords[0])
        minutes = float(coords[1])
        seconds = float(coords[2])
        dec = degrees + (minutes / 60.0) + (seconds / 3600.0)
        if ref in ['S', 'W']:
            dec = -dec
        return round(dec, 6)
    except Exception:
        return None

def extract_detailed_metadata(img: Image.Image) -> Dict[str, Any]:
    """
    Extracts camera metadata, capture timestamps, software editing tags,
    GPS location data, and ICC color profile safely.
    """
    meta = {
        "camera_make": None,
        "camera_model": None,
        "software": None,
        "capture_time": None,
        "gps_info": {},
        "icc_profile": None,
        "exif_raw": {}
    }

    # ICC Profile
    try:
        icc = img.info.get("icc_profile")
        if icc:
            meta["icc_profile"] = "Embedded ICC Profile Present"
    except Exception:
        pass

    try:
        raw_exif = img.getexif()
        if raw_exif:
            for tag_id, value in raw_exif.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                
                # Check for camera make/model
                if tag_name == "Make" and isinstance(value, str):
                    meta["camera_make"] = value.strip()
                elif tag_name == "Model" and isinstance(value, str):
                    meta["camera_model"] = value.strip()
                elif tag_name == "Software" and isinstance(value, str):
                    meta["software"] = value.strip()
                elif tag_name in ("DateTimeOriginal", "DateTimeDigitized", "DateTime") and isinstance(value, str):
                    if not meta["capture_time"]:
                        meta["capture_time"] = value.strip()

                # Add serializable raw exif
                if isinstance(value, (str, int, float)):
                    meta["exif_raw"][tag_name] = value
                elif isinstance(value, bytes):
                    meta["exif_raw"][tag_name] = value.hex()[:48]
                else:
                    meta["exif_raw"][tag_name] = str(value)[:96]

            # Parse GPS data if available
            try:
                gps_tag = 34853  # GPSInfo tag ID
                gps_data = raw_exif.get_ifd(gps_tag) if hasattr(raw_exif, "get_ifd") else None
                if gps_data:
                    lat = gps_data.get(2)
                    lat_ref = gps_data.get(1)
                    lon = gps_data.get(4)
                    lon_ref = gps_data.get(3)
                    if lat and lat_ref and lon and lon_ref:
                        dec_lat = _convert_gps_coordinate(lat, lat_ref)
                        dec_lon = _convert_gps_coordinate(lon, lon_ref)
                        if dec_lat is not None and dec_lon is not None:
                            meta["gps_info"] = {
                                "latitude": dec_lat,
                                "longitude": dec_lon,
                                "raw_ref": f"{lat_ref},{lon_ref}"
                            }
            except Exception:
                pass
    except Exception:
        pass

    return meta

def generate_safe_thumbnail(img: Image.Image, out_path: Path, max_size: Tuple[int, int] = (250, 250)) -> str:
    """
    Generates a high-quality downscaled thumbnail for the web UI without altering the original file.
    """
    try:
        thumb = img.copy()
        # Handle transparency if saving as JPEG
        if thumb.mode in ("RGBA", "LA", "P"):
            rgb_thumb = Image.new("RGB", thumb.size, (17, 24, 39))  # Dark panel background
            rgb_thumb.paste(thumb, mask=thumb.split()[-1] if thumb.mode in ("RGBA", "LA") else None)
            thumb = rgb_thumb
        elif thumb.mode != "RGB":
            thumb = thumb.convert("RGB")

        thumb.thumbnail(max_size, Image.Resampling.LANCZOS)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        thumb.save(out_path, format="JPEG", quality=85)
        return str(out_path)
    except Exception as e:
        return ""

def extract_image_fingerprints(image_bytes: bytes, asset_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Extracts multi-algorithm cryptographic and perceptual fingerprints from image bytes.
    SHA-256 for exact bitstream identity.
    pHash, dHash, aHash, wHash for perceptual, gradient, and frequency comparison.
    Generates a thumbnail image.
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

        meta = extract_detailed_metadata(img)

        # Generate thumbnail
        thumb_filename = f"thumb_{sha256_hash[:16]}.jpg"
        thumb_path = settings.THUMBNAILS_PATH / thumb_filename
        thumbnail_str = generate_safe_thumbnail(img, thumb_path)

    return {
        "sha256": sha256_hash,
        "perceptual_hash": phash_val,
        "difference_hash": dhash_val,
        "average_hash": ahash_val,
        "wavelet_hash": whash_val,
        "image_width": width,
        "image_height": height,
        "image_format": img_format,
        "camera_make": meta["camera_make"],
        "camera_model": meta["camera_model"],
        "software": meta["software"],
        "capture_time": meta["capture_time"],
        "gps_info": meta["gps_info"],
        "icc_profile": meta["icc_profile"],
        "exif_data": meta["exif_raw"],
        "thumbnail_path": thumbnail_str,
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
            clues.append("Perceptually identical (Hamming dist 0)")
        elif phash_dist <= 6:
            clues.append(f"Strong visual match with minor artifacts (Hamming dist {phash_dist})")
        elif phash_dist <= 12:
            clues.append(f"Moderate similarity with compression or cropping (Hamming dist {phash_dist})")
        else:
            clues.append(f"High visual distance (Hamming dist {phash_dist})")

    summary = "; ".join(clues) if clues else "Standard visual comparison"
    return summary, metadata
