# OriginTrace AI

**Tagline:** *Trace the content. Reconstruct the timeline. Verify the evidence.*

**Category:** Digital Safety & Cybersecurity / Digital Forensics

[![Tests](https://img.shields.io/badge/Tests-11%20Passed%20(100%25)-success)](https://github.com/origintrace-ai)
[![Zero--Cost](https://img.shields.io/badge/Zero--Cost-100%25%20FOSS-blue)](https://github.com/origintrace-ai)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 1. Overview

**OriginTrace AI** is a professional, open-source digital-forensics workbench. Given a public social-media post URL, an image, a screenshot, a video, or a text claim, OriginTrace AI discovers earlier publicly accessible appearances of the content across supported social platforms, public webpages, and web archives.

It compares evidence using multi-signal visual and textual fingerprinting, reconstructs a verified chronological timeline, identifies the **earliest discovered matching reference**, and produces transparent, exportable investigation reports.

The platform is designed to operate **100% free-first** without requiring paid AI APIs or paid social media subscriptions.

---

## 2. Core Forensic Principles

OriginTrace AI enforces strict digital safety rules:

1. **No False Origin Claims:** The system never claims that an account is the "definitive original creator" unless corroborated by primary evidence. It defaults to *"earliest discovered matching reference"*.
2. **Archive ≠ Publication:** The system distinguishes archive capture dates (Wayback Machine) from original publication dates.
3. **No Fabricated Fallbacks:** When an external connector fails, is rate-limited, or lacks credentials, the system records the real limitation instead of inventing synthetic search results.
4. **Transparent Scoring:** Similarity scores combine visible signals (SHA-256 bitstream match, pHash/dHash Hamming distance, OCR overlap, token containment) instead of opaque "AI confidence percentages".
5. **SSRF Protection:** Strict hostname and DNS IP verification blocks requests to private subnets (RFC 1918), loopback, link-local, and cloud metadata endpoints (`169.254.169.254`).

---

## 3. Technology Stack

### Backend
- **Python 3.12+ / 3.14+**
- **FastAPI** for high-throughput REST API endpoints
- **SQLAlchemy & SQLite** for zero-cost, serverless persistent storage
- **Pillow & ImageHash** for cryptographic (SHA-256) and perceptual hashing (pHash, dHash, aHash, wHash)
- **pytesseract** for optical character recognition (OCR)
- **httpx & BeautifulSoup4** for permitted public web queries and metadata parsing
- **NetworkX** for digraph evidence network topology
- **Pytest** for automated unit and benchmark test execution

### Frontend
- **React 18+ with TypeScript**
- **Vite** build tooling
- **Tailwind CSS v4** with dark forensic workspace theme
- **React Router** for multi-view navigation
- **Recharts** for platform distribution metrics
- **Lucide Icons** for forensic iconography

### External Public Connectors
- **Internet Archive Wayback Machine CDX API** (public, zero-key)
- **Bluesky Public AT Protocol Feed** (public, zero-key)
- **Mastodon Federated Instance API** (public, zero-key)
- **YouTube Data API v3** (optional developer quota)
- **Reddit OAuth Data API** (optional developer key)
- **Webpage Metadata Extractor** (SSRF-protected)

---

## 4. Navigation & Workspace Views

OriginTrace AI provides 9 core forensic views:

1. **Investigation Dashboard:** Case volume, discovered source counts, unresolved origins, connector health, and platform distributions.
2. **New Investigation:** Unified intake for public post URLs, images, screenshots, videos, text claims, or combined inputs with live progress tracking.
3. **Evidence Timeline:** Strict chronological provenance sequence distinguishing publication time, archive time, and retrieval time.
4. **Origin Graph:** Interactive node network showing relationships between target assets, discovered posts, archive snapshots, and authors.
5. **Image Analysis:** Detailed cryptographic and perceptual hash breakdown (pHash, dHash, aHash, wHash), dimensions, aspect ratio, and OCR text extraction.
6. **Social Source Explorer:** Direct workbench querying public Bluesky and Mastodon nodes with live status indicators.
7. **Archive Explorer:** Wayback Machine CDX historical snapshot inspector for any URL.
8. **Forensic Reports:** Structured report generator with clickable source links, exportable to JSON and standalone self-contained HTML.
9. **Settings & Source Connections:** Health status of all connectors, local tool detection, and environment configuration instructions.
10. **Benchmark Suite:** Real-time execution of the deterministic forensic evaluation testbed.

---

## 5. Quick Start & Installation

### Prerequisites
- Python 3.12+ (or compatible stable Python version)
- Node.js 18+ and npm

### 1. Clone & Set Up Backend

```bash
# Clone the repository
git clone https://github.com/origintrace-ai/origintrace.git
cd "origintrace"

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate   # Windows
# source venv/bin/activate # Linux / macOS

# Install backend dependencies
pip install -r backend/requirements.txt

# Seed demonstration forensic investigation (optional)
$env:PYTHONPATH="backend"
python scripts/seed_demo.py
```

### 2. Set Up Frontend

```bash
cd frontend
npm install
npm run build
```

### 3. Running the Application

In terminal 1 (Backend):
```bash
$env:PYTHONPATH="backend"
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Backend API will be accessible at: `http://127.0.0.1:8000`  
Swagger API Docs available at: `http://127.0.0.1:8000/docs`

In terminal 2 (Frontend):
```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
Frontend Workbench UI will be accessible at: `http://127.0.0.1:5173`

---

## 6. Running Tests & Benchmark

### Run the Pytest Test Suite
```bash
.\venv\Scripts\pytest.exe -v
```
Verifies SSRF filters, file validation, perceptual hashing, matching thresholds, timeline ordering, and synthetic benchmarks (11 passing tests).

### Run the Forensic Benchmark via API
```bash
curl -X POST http://127.0.0.1:8000/api/benchmark/run
```

---

## 7. Security Architecture

- **SSRF Protection:** Resolves hostnames and validates that destination IP addresses are not loopback (`127.0.0.0/8`), private RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), or link-local cloud metadata (`169.254.0.0/16`).
- **File Validation:** Binary inspection via Pillow prevents image file-bomb or script-execution vulnerabilities.
- **Data Privacy:** Local storage defaults to SQLite; investigations and assets can be deleted at any time.

---

## 8. License

This project is licensed under the MIT License.
