import re
from typing import List, Dict, Any, Set
from collections import Counter

URL_REGEX = re.compile(r'https?://[^\s<>"]+|www\.[^\s<>"]+')
HANDLE_REGEX = re.compile(r'(?:^|\s)@([A-Za-z0-9_.-]+)')
HASHTAG_REGEX = re.compile(r'(?:^|\s)#([A-Za-z0-9_]+)')
DATE_REGEX = re.compile(
    r'\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|'
    r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b',
    re.IGNORECASE
)

COMMON_STOPWORDS: Set[str] = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "up", "about", "into", "over", "after", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did", "this", "that",
    "these", "those", "it", "its", "they", "them", "their", "we", "us", "our", "you",
    "your", "he", "him", "his", "she", "her"
}

def normalize_text(text: str) -> str:
    """Normalize text for matching without discarding essential words."""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip().lower()

def extract_entities(text: str) -> Dict[str, Any]:
    """Extracts URLs, handles, hashtags, and apparent date strings from text."""
    if not text:
        return {"urls": [], "handles": [], "hashtags": [], "dates": []}

    urls = URL_REGEX.findall(text)
    handles = HANDLE_REGEX.findall(text)
    hashtags = HASHTAG_REGEX.findall(text)
    dates = DATE_REGEX.findall(text)

    return {
        "urls": list(set(urls)),
        "handles": list(set(handles)),
        "hashtags": list(set(hashtags)),
        "dates": list(set(dates))
    }

def extract_search_phrases(text: str, max_phrases: int = 4) -> List[str]:
    """
    Extracts high-signal distinctive phrases (3-6 words) for search connectors.
    Removes low-signal boilerplate and stopwords.
    """
    if not text:
        return []

    # Clean text
    clean = re.sub(r'https?://[^\s<>"]+', '', text)
    clean = re.sub(r'[@#][\w.-]+', '', clean)
    clean = re.sub(r'[^\w\s]', ' ', clean)
    words = [w for w in clean.split() if len(w) > 1]

    if not words:
        return []

    if len(words) <= 6:
        phrase = " ".join(words)
        return [phrase] if phrase else []

    phrases = []
    # Distinctive chunks
    chunk_size = 5
    for i in range(0, min(len(words), 20), chunk_size):
        chunk = words[i:i + chunk_size]
        meaningful = [w for w in chunk if w.lower() not in COMMON_STOPWORDS]
        if len(meaningful) >= 2:
            phrases.append(" ".join(chunk))
        if len(phrases) >= max_phrases:
            break

    return phrases

def compute_text_similarity(text1: str, text2: str) -> Dict[str, float]:
    """
    Computes token overlap, Jaccard similarity, and containment ratio between two texts.
    """
    if not text1 or not text2:
        return {"jaccard": 0.0, "containment": 0.0, "exact_match": 0.0}

    norm1 = normalize_text(text1)
    norm2 = normalize_text(text2)

    if norm1 == norm2 and norm1:
        return {"jaccard": 1.0, "containment": 1.0, "exact_match": 1.0}

    tokens1 = set(norm1.split())
    tokens2 = set(norm2.split())

    if not tokens1 or not tokens2:
        return {"jaccard": 0.0, "containment": 0.0, "exact_match": 0.0}

    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)

    jaccard = len(intersection) / len(union) if union else 0.0
    # Containment: how much of the smaller text is contained inside the larger text
    min_len = min(len(tokens1), len(tokens2))
    containment = len(intersection) / min_len if min_len > 0 else 0.0

    return {
        "jaccard": round(jaccard, 4),
        "containment": round(containment, 4),
        "exact_match": 0.0
    }
