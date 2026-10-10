# OriginTrace AI Benchmark Methodology

## Objective

The **Forensic Benchmark Suite** provides a deterministic, automated evaluation testbed to measure the precision, recall, false-match rate, and earliest-reference reconstruction accuracy of OriginTrace AI's matching engine.

## Dataset Structure

The benchmark testbed formulates ground truth items with known historical timestamps:

| Test Case | Variant Type | Expected Match | Ground Truth Role |
|-----------|--------------|----------------|-------------------|
| `GT-ORIGIN-001` | Original base image | Match (Exact / Strong) | **True Ground Truth Origin** (Published 2021-03-15 10:00:00 UTC) |
| `GT-ARCHIVE-002` | Identical bitstream archive snapshot | Match (Exact / Archive) | Archive Capture (Captured 2021-03-15 14:30:00 UTC) |
| `GT-RESIZED-003` | Scaled-down (50%) & JPEG recompressed | Match (Perceptual) | Transformed Repost (Published 2022-06-20 09:15:00 UTC) |
| `GT-UNRELATED-004` | Distinct geometrical & pattern control | Non-Match (Negative Control) | Unrelated content (Published 2023-11-05 18:00:00 UTC) |

## Evaluation Metrics

1. **Precision**:
   $$\text{Precision} = \frac{\text{True Positives}}{\text{True Positives} + \text{False Positives}}$$
   Measures the absence of false alarms when comparing visual or textual assets.

2. **Recall**:
   $$\text{Recall} = \frac{\text{True Positives}}{\text{True Positives} + \text{False Negatives}}$$
   Measures the system's ability to retrieve transformed, resized, or archived copies.

3. **False Match Rate**:
   $$\text{FMR} = \frac{\text{False Positives}}{\text{False Positives} + \text{True Negatives}}$$
   Verifies that negative controls are correctly flagged as inconclusive or unrelated.

4. **Earliest Known Source Accuracy**:
   $$\text{Accuracy} = \mathbb{I}(\text{Discovered Earliest ID} == \text{GT-ORIGIN-001})$$
   Validates that the chronological reconstruction pipeline selects the earliest verified candidate.

## How to Run the Benchmark

### 1. In the Web UI
Navigate to **Benchmark Suite** in the sidebar and click **Execute Benchmark Suite**.

### 2. Via REST API
```bash
curl -X POST http://127.0.0.1:8000/api/benchmark/run
```

### 3. Via Pytest Automated Suite
```bash
pytest backend/tests/test_timeline.py -v
```
