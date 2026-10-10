# OriginTrace AI Architecture

## Overview

**OriginTrace AI** is an open-source, digital-forensics workbench designed to trace public social-media posts, images, screenshots, videos, and text claims back to their earliest discovered public appearances across web archives and public social platforms.

```
+-----------------------------------------------------------------------------------+
|                                ORIGINTRACE AI                                     |
|  Tagline: Trace the content. Reconstruct the timeline. Verify the evidence.        |
+-----------------------------------------------------------------------------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
             [Frontend Workspace]                      [Backend REST API]
         React + TypeScript + Vite                   FastAPI + SQLAlchemy
         Tailwind CSS + React Flow                  SQLite Zero-Cost Engine
                     |                                         |
        +------------+------------+             +--------------+---------------+
        |                         |             |                              |
[Forensic Views]          [React Flow Graph] [Security & SSRF]        [Analysis Engines]
- Dashboard               - Nodes / Edges    - RFC1918 blocker        - Cryptographic (SHA-256)
- New Investigation       - Provenance Links - Link-local filter      - Perceptual (pHash, dHash)
- Evidence Timeline       - Inspector        - DNS resolution check   - Gradient (aHash, wHash)
- Origin Graph                                                        - OCR (pytesseract)
- Image Analysis                                                      - NLP entity & phrases
- Social Explorer                                                              |
- Archive Explorer                                              +--------------+---------------+
- Forensic Reports                                              |                              |
- Connectors / Settings                                  [Connectors]                  [Data Pipelines]
                                                         - Wayback CDX                 - Deduplication
                                                         - Bluesky Feed                - Multi-signal Scoring
                                                         - Mastodon V2                 - Chronological Timeline
                                                         - YouTube (opt)               - Origin Graph Builder
                                                         - Reddit (opt)                - Report Generator
                                                         - Web Metadata                - Benchmark Suite
```

## Core Modules

### 1. Security & SSRF Protection (`app/core/security.py`)
- Restricts target URLs strictly to `http` and `https`.
- Resolves hostname via DNS and enforces non-routable, loopback (127.0.0.1, ::1), private RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata (`169.254.169.254`) blocks.
- Validates uploaded image byte payloads with Pillow integrity checks before storage.

### 2. Multi-Signal Fingerprinting (`app/services/fingerprint.py`)
- **SHA-256**: Bitstream exact identity.
- **pHash**: Discrete Cosine Transform (DCT) based perceptual hash for near-identical visual content under scaling and recompression.
- **dHash & aHash**: Gradient luminance and low-frequency average hashes.
- **Transformation Analysis**: Aspect ratio distortion, dimension ratios, and cropping heuristic detection.

### 3. Chronological Timeline & Origin Analysis (`app/timeline/builder.py`)
- Timestamps stored strictly in UTC.
- Distinguishes:
  - Source publication timestamp
  - Source creation timestamp
  - Wayback Machine archival snapshot timestamp
  - OriginTrace retrieval timestamp
- Establishes the **earliest discovered matching reference** without falsely claiming definitive primary authorship without corroborating primary evidence.

### 4. Interactive Origin Graph (`app/graph/builder.py`)
- Built on NetworkX digraph structure.
- Distinct edge types:
  - `exact_duplicate`
  - `visual_similarity`
  - `same_claim`
  - `archive_capture`
  - `published_by`

### 5. Multi-Source Connectors (`app/connectors/`)
- Standardized `BaseConnector` interface.
- Graceful degradation when optional keys are absent.
- Full execution logging (duration, status, coverage notes, error message).
