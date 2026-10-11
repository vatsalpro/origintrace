import hashlib
from io import BytesIO
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import httpx
from PIL import Image
from app.core.config import settings
from app.core.security import validate_public_url
from app.services.fingerprint import extract_image_fingerprints, compare_hashes, analyze_transformation_clues
from app.matching.engine import evaluate_image_match

async def retrieve_and_compare_candidate_image(
    target_fp: Dict[str, Any],
    candidate_image_url: str,
    investigation_id: str
) -> Optional[Dict[str, Any]]:
    """
    Safely retrieves a candidate image discovered via online connectors,
    applies SSRF checks and download constraints, calculates perceptual fingerprints,
    and performs side-by-side comparison with the target evidence.
    """
    if not candidate_image_url or not isinstance(candidate_image_url, str):
        return None

    # 1. SSRF and public URL validation
    is_safe, msg = validate_public_url(candidate_image_url)
    if not is_safe:
        return {
            "retrieval_status": "blocked_ssrf",
            "error": f"Candidate image URL blocked by SSRF filter: {msg}"
        }

    # 2. Download with size limit and timeout
    headers = {"User-Agent": "OriginTraceAI-Forensics/1.0 (+https://github.com/origintrace-ai)"}
    try:
        async with httpx.AsyncClient(timeout=settings.DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=True, headers=headers) as client:
            resp = await client.get(candidate_image_url)
            if resp.status_code == 403:
                return {
                    "retrieval_status": "forbidden_403",
                    "status_code": 403,
                    "error": "Candidate image server returned HTTP 403 Forbidden (hotlink protection, WAF, or Cloudflare guard)."
                }
            elif resp.status_code == 401:
                return {
                    "retrieval_status": "unauthorized_401",
                    "status_code": 401,
                    "error": "Candidate image requires authentication or credentials to access."
                }
            elif resp.status_code == 404:
                return {
                    "retrieval_status": "not_found_404",
                    "status_code": 404,
                    "error": "Candidate image returned HTTP 404 Not Found (resource deleted or moved)."
                }
            elif resp.status_code != 200:
                return {
                    "retrieval_status": "http_error",
                    "status_code": resp.status_code,
                    "error": f"Candidate server returned HTTP {resp.status_code}"
                }

            content = resp.content
            if len(content) > settings.MAX_DOWNLOAD_SIZE_BYTES:
                return {
                    "retrieval_status": "size_exceeded",
                    "error": "Candidate image exceeded size limit."
                }

            # 3. Verify image integrity with Pillow
            try:
                with Image.open(BytesIO(content)) as test_img:
                    test_img.verify()
                    cand_w, cand_h = test_img.size
            except Exception as e:
                return {
                    "retrieval_status": "invalid_image",
                    "error": f"Invalid candidate image format: {str(e)}"
                }

            # 4. Fingerprint candidate image
            cand_fp = extract_image_fingerprints(content)

            # 5. Save cached candidate thumbnail for UI side-by-side comparison
            cand_thumb_filename = f"cand_{hashlib.sha256(content).hexdigest()[:16]}.jpg"
            cand_thumb_path = settings.CANDIDATES_PATH / cand_thumb_filename
            try:
                with Image.open(BytesIO(content)) as c_img:
                    c_thumb = c_img.convert("RGB")
                    c_thumb.thumbnail((250, 250), Image.Resampling.LANCZOS)
                    c_thumb.save(cand_thumb_path, format="JPEG", quality=80)
                    saved_thumb_str = str(cand_thumb_path)
            except Exception:
                saved_thumb_str = None

            # 6. Compare with target
            match_type, composite_score, strength, signals = evaluate_image_match(
                target_fp.get("sha256"),
                target_fp.get("perceptual_hash"),
                target_fp.get("difference_hash"),
                target_fp.get("image_width"),
                target_fp.get("image_height"),
                cand_fp.get("sha256"),
                cand_fp.get("perceptual_hash"),
                cand_fp.get("difference_hash"),
                cand_fp.get("image_width"),
                cand_fp.get("image_height")
            )

            # Calculate individual visual similarity metric (0.0 to 1.0)
            phash_dist = signals.get("phash_distance")
            if signals.get("sha256_match"):
                visual_sim = 1.0
            elif phash_dist is not None:
                # 0 dist = 1.0; 6 dist = 0.70; 16+ dist = 0.0
                visual_sim = max(0.0, round(1.0 - (phash_dist / 16.0), 3))
            else:
                visual_sim = 0.0

            explanation = (
                f"Candidate image retrieved ({cand_w}x{cand_h}). "
                f"Perceptual Hamming distance: {phash_dist if phash_dist is not None else 'N/A'}. "
                f"Clues: {signals.get('transformation_clues', 'None')}. "
                f"Observation: Visual comparison performed on downloaded bytes. "
                f"Notice: High visual similarity indicates shared appearance or derivative copy; does not establish primary author copyright."
            )

            return {
                "retrieval_status": "success",
                "candidate_image_url": candidate_image_url,
                "candidate_thumbnail_path": saved_thumb_str,
                "candidate_sha256": cand_fp.get("sha256"),
                "candidate_phash": cand_fp.get("perceptual_hash"),
                "candidate_dhash": cand_fp.get("difference_hash"),
                "candidate_width": cand_w,
                "candidate_height": cand_h,
                "visual_similarity": visual_sim,
                "match_type": match_type,
                "composite_score": composite_score,
                "evidence_strength": strength,
                "match_signals": signals,
                "explanation": explanation
            }

    except httpx.TimeoutException:
        return {
            "retrieval_status": "timeout",
            "error": "Timeout retrieving candidate image."
        }
    except Exception as e:
        return {
            "retrieval_status": "error",
            "error": str(e)
        }
