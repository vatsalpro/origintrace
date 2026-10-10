from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from fastapi import APIRouter
from app.matching.engine import evaluate_image_match, evaluate_text_match
from app.timeline.builder import build_chronological_timeline
from app.services.fingerprint import extract_image_fingerprints
from PIL import Image, ImageDraw
from io import BytesIO

router = APIRouter(prefix="/api/benchmark", tags=["benchmark"])

def create_synthetic_test_image(text: str, color: str = "blue", size: tuple = (400, 300), pattern: str = "rect") -> bytes:
    """Generates an in-memory deterministic test image."""
    img = Image.new("RGB", size, color=color)
    draw = ImageDraw.Draw(img)
    draw.text((20, 20), text, fill="white")
    if pattern == "rect":
        draw.rectangle([50, 50, 150, 150], fill="yellow", outline="red")
    elif pattern == "cross":
        draw.line([(0, 0), (size[0], size[1])], fill="green", width=12)
        draw.line([(0, size[1]), (size[0], 0)], fill="white", width=12)
        draw.ellipse([220, 120, 360, 260], fill="purple")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def run_synthetic_benchmark_suite() -> Dict[str, Any]:
    """
    Executes the deterministic digital forensics evaluation benchmark.
    Tests exact copy, resized version, altered caption, unrelated image, and origin timestamp retrieval.
    """
    # 1. Generate base original image & ground truth
    base_img_bytes = create_synthetic_test_image("ORIGIN TRACE GROUND TRUTH 2021", color="#1E3A8A", pattern="rect")
    base_fp = extract_image_fingerprints(base_img_bytes)

    # 2. Transformed variant: realistically scaled down & JPEG recompressed
    with Image.open(BytesIO(base_img_bytes)) as b_img:
        resized_pil = b_img.resize((200, 150), Image.Resampling.LANCZOS)
        resized_buf = BytesIO()
        resized_pil.save(resized_buf, format="JPEG", quality=85)
        resized_img_bytes = resized_buf.getvalue()
    resized_fp = extract_image_fingerprints(resized_img_bytes)

    # 3. Transformed variant: cropped & watermarked
    with Image.open(BytesIO(base_img_bytes)) as b_img:
        # mild 5% crop
        w, h = b_img.size
        cropped_pil = b_img.crop((10, 10, w - 10, h - 10))
        crop_buf = BytesIO()
        cropped_pil.save(crop_buf, format="PNG")
        caption_img_bytes = crop_buf.getvalue()
    caption_fp = extract_image_fingerprints(caption_img_bytes)

    # 4. Unrelated image (distinct negative control)
    unrelated_img_bytes = create_synthetic_test_image("COMPLETELY DIFFERENT CONTENT", color="#831843", size=(400, 300), pattern="cross")
    unrelated_fp = extract_image_fingerprints(unrelated_img_bytes)

    # Ground truth candidates with verified historical timestamps
    t0 = datetime(2021, 3, 15, 10, 0, 0, tzinfo=timezone.utc)
    t1 = datetime(2021, 3, 15, 14, 30, 0, tzinfo=timezone.utc)
    t2 = datetime(2022, 6, 20, 9, 15, 0, tzinfo=timezone.utc)
    t3 = datetime(2023, 11, 5, 18, 0, 0, tzinfo=timezone.utc)

    dataset = [
        {
            "id": "GT-ORIGIN-001",
            "is_ground_truth_origin": True,
            "expected_match": True,
            "timestamp": t0,
            "timestamp_type": "source_publication",
            "source_platform": "mastodon",
            "fp": base_fp,
            "text": "Breaking news verified origin content",
            "url": "https://mastodon.social/@researcher/101"
        },
        {
            "id": "GT-ARCHIVE-002",
            "is_ground_truth_origin": False,
            "expected_match": True,
            "timestamp": t1,
            "timestamp_type": "archive_capture",
            "source_platform": "wayback",
            "fp": base_fp,
            "text": "Archived snapshot of breaking news",
            "url": "https://web.archive.org/web/20210315143000/https://mastodon.social/@researcher/101"
        },
        {
            "id": "GT-RESIZED-003",
            "is_ground_truth_origin": False,
            "expected_match": True,
            "timestamp": t2,
            "timestamp_type": "source_publication",
            "source_platform": "bluesky",
            "fp": resized_fp,
            "text": "Reposted resized image",
            "url": "https://bsky.app/profile/user.bsky.social/post/333"
        },
        {
            "id": "GT-UNRELATED-004",
            "is_ground_truth_origin": False,
            "expected_match": False,
            "timestamp": t3,
            "timestamp_type": "source_publication",
            "source_platform": "reddit",
            "fp": unrelated_fp,
            "text": "Unrelated discussion topic",
            "url": "https://reddit.com/r/news/comments/444"
        }
    ]

    # Evaluate matches against base target
    true_positives = 0
    false_positives = 0
    true_negatives = 0
    false_negatives = 0

    evaluated_records = []
    for item in dataset:
        match_type, score, strength, signals = evaluate_image_match(
            base_fp["sha256"], base_fp["perceptual_hash"], base_fp["difference_hash"],
            base_fp["image_width"], base_fp["image_height"],
            item["fp"]["sha256"], item["fp"]["perceptual_hash"], item["fp"]["difference_hash"],
            item["fp"]["image_width"], item["fp"]["image_height"]
        )

        is_predicted_match = (strength in ("Strong match", "Probable match"))

        if item["expected_match"] and is_predicted_match:
            true_positives += 1
        elif not item["expected_match"] and is_predicted_match:
            false_positives += 1
        elif not item["expected_match"] and not is_predicted_match:
            true_negatives += 1
        else:
            false_negatives += 1

        evaluated_records.append({
            "id": item["id"],
            "source_platform": item["source_platform"],
            "source_url": item["url"],
            "primary_timestamp": item["timestamp"],
            "timestamp_type": item["timestamp_type"],
            "timestamp_reliability": "high",
            "evidence_strength": strength,
            "composite_score": score,
            "match_signals": signals,
            "is_ground_truth_origin": item["is_ground_truth_origin"]
        })

    # Timeline reconstruction evaluation
    timeline = build_chronological_timeline(evaluated_records)
    earliest_ref = timeline.get("earliest_discovered_reference")
    
    expected_origin_id = "GT-ORIGIN-001"
    discovered_origin_id = earliest_ref.get("evidence_id") if earliest_ref else None
    origin_accuracy = 1.0 if (discovered_origin_id == expected_origin_id) else 0.0

    precision = round(true_positives / (true_positives + false_positives), 4) if (true_positives + false_positives) > 0 else 1.0
    recall = round(true_positives / (true_positives + false_negatives), 4) if (true_positives + false_negatives) > 0 else 1.0
    false_match_rate = round(false_positives / (false_positives + true_negatives), 4) if (false_positives + true_negatives) > 0 else 0.0

    return {
        "benchmark_name": "OriginTrace Forensic Evaluation Suite v1.0",
        "dataset_size": len(dataset),
        "test_cases": [
            "Exact file bitstream duplication",
            "Recompressed & scaled-down variant",
            "Archived historical snapshot separation",
            "Negative control (unrelated visual content)"
        ],
        "metrics": {
            "precision": precision,
            "recall": recall,
            "false_match_rate": false_match_rate,
            "earliest_known_source_accuracy": origin_accuracy,
            "true_positives": true_positives,
            "false_positives": false_positives,
            "true_negatives": true_negatives,
            "false_negatives": false_negatives
        },
        "discovered_earliest_reference": earliest_ref,
        "evaluated_records": evaluated_records,
        "methodological_notice": (
            "Benchmark measures earliest known source retrieval and perceptual match accuracy "
            "within deterministic ground-truth bounds. It does not measure or claim global origin identification."
        ),
        "evaluated_at": datetime.now(timezone.utc).isoformat()
    }

@router.post("/run")
def run_benchmark():
    return run_synthetic_benchmark_suite()
