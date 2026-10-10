from app.matching.engine import evaluate_image_match, evaluate_text_match

def test_image_exact_match():
    sha = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    m_type, score, strength, signals = evaluate_image_match(
        sha, "8f8f8f8f8f8f8f8f", "8f8f8f8f8f8f8f8f", 200, 200,
        sha, "8f8f8f8f8f8f8f8f", "8f8f8f8f8f8f8f8f", 200, 200
    )
    assert m_type == "exact"
    assert score == 1.0
    assert strength == "Strong match"
    assert signals["sha256_match"] is True

def test_text_exact_match():
    text = "Breaking report: unprecedented event observed in the atmosphere."
    m_type, score, strength, signals = evaluate_text_match(text, text)
    assert m_type == "exact"
    assert score == 1.0
    assert strength == "Strong match"
    assert signals["exact_match"] is True

def test_text_partial_claim():
    t1 = "Breaking report: unprecedented event observed in the atmosphere."
    t2 = "Unprecedented event observed in the atmosphere today according to reports."
    m_type, score, strength, _ = evaluate_text_match(t1, t2)
    assert m_type in ("strong_claim", "semantic_claim")
    assert score >= 0.6
