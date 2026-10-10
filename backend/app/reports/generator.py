from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

def generate_investigation_report(
    investigation: Dict[str, Any],
    assets: List[Dict[str, Any]],
    evidence: List[Dict[str, Any]],
    connector_logs: List[Dict[str, Any]],
    earliest_reference: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Generates structured forensic report (JSON & self-contained HTML).
    Guarantees that all statements originate strictly from recorded evidence.
    """
    inv_id = investigation.get("id")
    title = investigation.get("title", f"Investigation {inv_id}")
    input_type = investigation.get("input_type")
    input_content = investigation.get("input_content", "Uploaded File")
    created_at = investigation.get("created_at")

    # Connector coverage breakdown
    coverage_summary = {
        "completed_with_matches": 0,
        "completed_no_matches": 0,
        "rate_limited": 0,
        "not_configured": 0,
        "error": 0,
        "total_connectors_queried": len(connector_logs)
    }
    for log in connector_logs:
        st = log.get("status", "unknown")
        if st in coverage_summary:
            coverage_summary[st] += 1

    # Findings metrics
    findings_count = len(evidence)
    strong_matches = sum(1 for e in evidence if e.get("evidence_strength") == "Strong match")
    probable_matches = sum(1 for e in evidence if e.get("evidence_strength") == "Probable match")

    # Executive Summary text
    earliest_desc = "No matching prior public appearance discovered across active search sources."
    if earliest_reference:
        earliest_desc = (
            f"Earliest discovered matching reference was detected on {earliest_reference.get('platform', '').upper()} "
            f"dated {earliest_reference.get('timestamp')} by {earliest_reference.get('author') or 'unknown author'} "
            f"(Source: {earliest_reference.get('url')})."
        )

    exec_summary = (
        f"OriginTrace AI conducted a forensic provenance inquiry on '{title}' (Input Type: {input_type}). "
        f"{earliest_desc} "
        f"A total of {findings_count} evidence records were collected across {len(connector_logs)} connector runs, "
        f"comprising {strong_matches} strong matches and {probable_matches} probable matches. "
        f"Notice: The identified reference represents the earliest discovered appearance within queried public indexes, "
        f"and does not constitute definitive proof of original creation unless corroborated by primary author authentication."
    )

    # HTML Report Generation
    evidence_rows_html = ""
    for ev in evidence:
        ts_str = ev.get("primary_timestamp")
        ts_display = ts_str.strftime("%Y-%m-%d %H:%M:%S UTC") if hasattr(ts_str, "strftime") else str(ts_str or "Undated")
        evidence_rows_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #1e293b; color: #38BDF8;"><strong>{ev.get('source_platform', '').upper()}</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #1e293b;"><a href="{ev.get('source_url')}" target="_blank" style="color: #38BDF8; text-decoration: underline;">{ev.get('source_url')[:45]}...</a></td>
            <td style="padding: 10px; border-bottom: 1px solid #1e293b;">{ev.get('author_name') or ev.get('author_handle') or 'N/A'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #1e293b;">{ts_display}</td>
            <td style="padding: 10px; border-bottom: 1px solid #1e293b;"><span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: #1e293b; color: #F8FAFC;">{ev.get('evidence_strength')}</span></td>
            <td style="padding: 10px; border-bottom: 1px solid #1e293b; color: #94A3B8; font-size: 13px;">{ev.get('content_snippet', '')[:120]}</td>
        </tr>
        """

    connector_rows_html = ""
    for c in connector_logs:
        connector_rows_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #1e293b;"><strong>{c.get('connector_name')}</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #1e293b;">{c.get('status')}</td>
            <td style="padding: 8px; border-bottom: 1px solid #1e293b;">{c.get('results_count')}</td>
            <td style="padding: 8px; border-bottom: 1px solid #1e293b; color: #94A3B8; font-size: 13px;">{c.get('coverage_notes', '')}</td>
        </tr>
        """

    asset_details_html = ""
    for a in assets:
        asset_details_html += f"""
        <div style="background: #182235; padding: 12px; border-radius: 6px; margin-bottom: 10px; font-family: monospace; font-size: 13px;">
            <div><strong>Asset Type:</strong> {a.get('asset_type')}</div>
            <div><strong>SHA-256:</strong> {a.get('sha256') or 'N/A'}</div>
            <div><strong>Perceptual Hash (pHash):</strong> {a.get('perceptual_hash') or 'N/A'}</div>
            <div><strong>Difference Hash (dHash):</strong> {a.get('difference_hash') or 'N/A'}</div>
            <div><strong>Dimensions:</strong> {a.get('image_width')}x{a.get('image_height')} ({a.get('image_format') or 'N/A'})</div>
            <div><strong>OCR Extracted Text:</strong> {a.get('ocr_text') or '(None)'}</div>
        </div>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>OriginTrace AI Forensic Report - {inv_id}</title>
    <style>
        body {{
            background-color: #0B1020;
            color: #F8FAFC;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 40px;
            line-height: 1.6;
        }}
        .report-card {{
            background: #111827;
            border: 1px solid #1e293b;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 24px;
        }}
        h1, h2, h3 {{ color: #F8FAFC; margin-top: 0; }}
        h1 {{ border-bottom: 2px solid #38BDF8; padding-bottom: 12px; }}
        .badge {{ background: #38BDF8; color: #0B1020; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }}
        table {{ width: 100%; border-collapse: collapse; text-align: left; margin-top: 12px; }}
        th {{ background: #182235; padding: 10px; color: #94A3B8; font-size: 13px; text-transform: uppercase; }}
        .callout {{ background: #182235; border-left: 4px solid #38BDF8; padding: 16px; border-radius: 4px; margin: 16px 0; }}
        .warning-callout {{ background: #1f1b24; border-left: 4px solid #F59E0B; padding: 16px; border-radius: 4px; margin: 16px 0; }}
    </style>
</head>
<body>
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px;">
        <div>
            <span class="badge">ORIGINTRACE AI FORENSIC REPORT</span>
            <h1 style="margin: 8px 0 0 0;">Investigation {inv_id}: {title}</h1>
            <div style="color: #94A3B8; font-size: 14px;">Input Target: {input_content} | Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</div>
        </div>
    </div>

    <div class="report-card">
        <h2>1. Executive Summary</h2>
        <p>{exec_summary}</p>
        <div class="callout">
            <strong>Earliest Discovered Reference:</strong><br>
            {earliest_desc}
        </div>
    </div>

    <div class="report-card">
        <h2>2. Target Asset Fingerprints & Analysis</h2>
        {asset_details_html or "<p style='color: #94A3B8;'>No asset files were uploaded for this inquiry.</p>"}
    </div>

    <div class="report-card">
        <h2>3. Discovered Public Evidence ({findings_count} Records)</h2>
        <table>
            <thead>
                <tr>
                    <th>Platform</th>
                    <th>Source URL</th>
                    <th>Author / Handle</th>
                    <th>Publication / Capture Date</th>
                    <th>Evidence Strength</th>
                    <th>Content Excerpt</th>
                </tr>
            </thead>
            <tbody>
                {evidence_rows_html or "<tr><td colspan='6' style='padding: 16px; text-align: center; color: #94A3B8;'>No evidence records discovered.</td></tr>"}
            </tbody>
        </table>
    </div>

    <div class="report-card">
        <h2>4. Search Connector Coverage & Integrity</h2>
        <table>
            <thead>
                <tr>
                    <th>Connector</th>
                    <th>Execution Status</th>
                    <th>Discovered Results</th>
                    <th>Coverage Notes / Limitations</th>
                </tr>
            </thead>
            <tbody>
                {connector_rows_html}
            </tbody>
        </table>
    </div>

    <div class="report-card">
        <h2>5. Forensic Limitations & Methodological Notice</h2>
        <div class="warning-callout">
            <ul style="margin: 0; padding-left: 20px; color: #F8FAFC;">
                <li>The identification of an 'earliest discovered reference' does not prove original copyright authorship or primary generation.</li>
                <li>Archive capture dates (Internet Archive Wayback Machine) demonstrate historical existence at the recorded moment, but do not equate to original source publication dates.</li>
                <li>Private, deleted, paywalled, or non-indexed platforms cannot be accounted for by public search connectors.</li>
                <li>Perceptual image hashes reflect visual similarity and can be influenced by crops, aspect ratio adjustments, or compression artifacts.</li>
            </ul>
        </div>
    </div>
</body>
</html>
"""

    def serialize_obj(o):
        if isinstance(o, datetime):
            return o.isoformat()
        if isinstance(o, dict):
            return {k: serialize_obj(v) for k, v in o.items()}
        if isinstance(o, list):
            return [serialize_obj(i) for i in o]
        return o

    report_json = {
        "investigation_id": inv_id,
        "title": title,
        "input_type": input_type,
        "input_content": input_content,
        "executive_summary": exec_summary,
        "earliest_discovered_reference": serialize_obj(earliest_reference),
        "findings_count": findings_count,
        "strong_matches": strong_matches,
        "probable_matches": probable_matches,
        "coverage_summary": coverage_summary,
        "evidence_records": serialize_obj(evidence),
        "connector_logs": serialize_obj(connector_logs),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

    return {
        "id": f"REP-{inv_id}",
        "investigation_id": inv_id,
        "executive_summary": exec_summary,
        "earliest_reference": serialize_obj(earliest_reference),
        "findings_count": findings_count,
        "coverage_summary": coverage_summary,
        "report_html": html_content,
        "report_json": report_json,
        "generated_at": datetime.now(timezone.utc)
    }
