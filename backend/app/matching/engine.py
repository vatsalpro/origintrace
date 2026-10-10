from typing import Dict, Any, Tuple, Optional
from app.services.fingerprint import compare_hashes, analyze_transformation_clues
from app.services.text_nlp import compute_text_similarity, normalize_text

class MatchingThresholds:
    # Image thresholds
    EXACT_HASH_DISTANCE: int = 0
    STRONG_VISUAL_DISTANCE: int = 6       # pHash distance <= 6
    POSSIBLE_TRANSFORM_DISTANCE: int = 12 # pHash distance <= 12
    
    # Text thresholds
    EXACT_TEXT_MATCH: float = 1.0
    HIGH_TEXT_OVERLAP: float = 0.70
    MODERATE_TEXT_OVERLAP: float = 0.35

def evaluate_image_match(
    target_sha256: Optional[str],
    target_phash: Optional[str],
    target_dhash: Optional[str],
    target_w: Optional[int],
    target_h: Optional[int],
    cand_sha256: Optional[str],
    cand_phash: Optional[str],
    cand_dhash: Optional[str],
    cand_w: Optional[int],
    cand_h: Optional[int]
) -> Tuple[str, float, str, Dict[str, Any]]:
    """
    Evaluates multi-signal image similarity.
    Returns (match_type, composite_score, evidence_strength, signals_dict)
    """
    signals: Dict[str, Any] = {
        "sha256_match": False,
        "phash_distance": None,
        "dhash_distance": None,
        "dimension_comparison": None,
        "transformation_clues": ""
    }

    # 1. Exact bitstream check
    if target_sha256 and cand_sha256 and target_sha256.lower() == cand_sha256.lower():
        signals["sha256_match"] = True
        signals["phash_distance"] = 0
        signals["dhash_distance"] = 0
        signals["transformation_clues"] = "Exact identical file bitstream (SHA-256 match)"
        return "exact", 1.0, "Strong match", signals

    # 2. Perceptual distance check
    phash_dist = compare_hashes(target_phash, cand_phash)
    dhash_dist = compare_hashes(target_dhash, cand_dhash)
    signals["phash_distance"] = phash_dist
    signals["dhash_distance"] = dhash_dist

    clues, dim_meta = analyze_transformation_clues(target_w, target_h, cand_w, cand_h, phash_dist, dhash_dist)
    signals["dimension_comparison"] = dim_meta
    signals["transformation_clues"] = clues

    if phash_dist is not None:
        if phash_dist == 0:
            score = 0.98 if dhash_dist == 0 else 0.95
            return "strong_visual", score, "Strong match", signals
        elif phash_dist <= MatchingThresholds.STRONG_VISUAL_DISTANCE:
            # 1 to 6 Hamming distance
            score = round(1.0 - (phash_dist * 0.05), 3)
            return "strong_visual", score, "Strong match", signals
        elif phash_dist <= MatchingThresholds.POSSIBLE_TRANSFORM_DISTANCE:
            # 7 to 12 Hamming distance (recompressed/cropped/watermarked)
            score = round(0.70 - ((phash_dist - 6) * 0.04), 3)
            return "transformed_copy", score, "Probable match", signals
        else:
            score = max(0.0, round(0.40 - ((phash_dist - 12) * 0.02), 3))
            return "unrelated", score, "Inconclusive", signals

    return "inconclusive", 0.0, "Inconclusive", signals


def evaluate_text_match(
    target_text: Optional[str],
    cand_text: Optional[str]
) -> Tuple[str, float, str, Dict[str, Any]]:
    """
    Evaluates multi-signal text match.
    Returns (match_type, composite_score, evidence_strength, signals_dict)
    """
    signals: Dict[str, Any] = {
        "jaccard_similarity": 0.0,
        "containment_ratio": 0.0,
        "exact_match": False
    }

    if not target_text or not cand_text:
        return "inconclusive", 0.0, "Inconclusive", signals

    sim_res = compute_text_similarity(target_text, cand_text)
    signals["jaccard_similarity"] = sim_res["jaccard"]
    signals["containment_ratio"] = sim_res["containment"]
    signals["exact_match"] = bool(sim_res["exact_match"] == 1.0)

    if signals["exact_match"]:
        return "exact", 1.0, "Strong match", signals

    jaccard = sim_res["jaccard"]
    containment = sim_res["containment"]

    if containment >= MatchingThresholds.HIGH_TEXT_OVERLAP:
        score = round(0.80 + (containment * 0.15), 3)
        return "strong_claim", score, "Strong match", signals
    elif containment >= MatchingThresholds.MODERATE_TEXT_OVERLAP or jaccard >= 0.30:
        score = round(0.60 + (containment * 0.20), 3)
        return "semantic_claim", score, "Probable match", signals
    elif containment >= 0.15:
        score = 0.45
        return "related_claim", score, "Possible match", signals
    else:
        return "unrelated", 0.1, "Inconclusive", signals
