import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.core.url_validator import validate_and_normalize_source_url

def parse_iso_or_any_timestamp(val: Any) -> Optional[datetime]:
    """
    Safely parses datetime objects, ISO 8601 strings, Wayback 14-digit strings,
    RFC formats, and date-only strings into a timezone-aware UTC datetime.
    Returns None if missing, malformed, or unparseable.
    """
    if val is None:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc)
    if isinstance(val, (int, float)):
        try:
            ts = float(val)
            if ts > 1e11:  # milliseconds
                ts /= 1000.0
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        except Exception:
            return None
    if isinstance(val, str):
        val = val.strip()
        if not val or val.lower() in ("none", "null", "n/a", "unknown", "undefined"):
            return None
        # Try standard ISO 8601
        try:
            iso_str = val.replace("Z", "+00:00")
            dt = datetime.fromisoformat(iso_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            pass
        # Try Wayback 14-digit format: YYYYMMDDHHMMSS
        if len(val) >= 8 and val[:8].isdigit():
            try:
                digits = val[:14].ljust(14, '0')
                dt = datetime.strptime(digits, "%Y%m%d%H%M%S")
                return dt.replace(tzinfo=timezone.utc)
            except Exception:
                pass
        # Try common date/time formats
        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%Y/%m/%d",
            "%a, %d %b %Y %H:%M:%S %Z",
            "%a, %d %b %Y %H:%M:%S GMT",
        ):
            try:
                dt = datetime.strptime(val, fmt)
                return dt.replace(tzinfo=timezone.utc)
            except Exception:
                pass
    return None


def format_iso_timestamp(dt: Optional[datetime]) -> Optional[str]:
    """Formats a timezone-aware UTC datetime to ISO 8601 string."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def build_chronological_timeline(
    evidence_records: List[Dict[str, Any]],
    investigation: Optional[Any] = None,
    assets: Optional[List[Any]] = None,
    logs: Optional[List[Any]] = None,
    include_processing_events: bool = True
) -> Dict[str, Any]:
    """
    Constructs a comprehensive, verified chronological timeline of discovered evidence.
    Accurately categorizes and separates:
      A. Dated source evidence (source publication, archive captures)
      B. Evidence collection events (discovered items labeled with OriginTrace collection timestamp)
      C. Undated evidence (items without usable historical or retrieval timestamps)
      D. System processing events (intake, hashing, OCR, search execution, visual comparison)
    """
    dated_events: List[Dict[str, Any]] = []
    undated_events: List[Dict[str, Any]] = []
    collection_events: List[Dict[str, Any]] = []
    source_events: List[Dict[str, Any]] = []
    archive_events: List[Dict[str, Any]] = []
    provenance_events: List[Dict[str, Any]] = []
    processing_events: List[Dict[str, Any]] = []
    warnings: List[str] = []
    limitations: List[str] = []

    inv_id = ""
    inv_created_at_dt = None
    if investigation:
        inv_id = getattr(investigation, "id", "") or str(investigation.get("id", "") if isinstance(investigation, dict) else "")
        inv_created_at_dt = parse_iso_or_any_timestamp(
            getattr(investigation, "created_at", None) or (investigation.get("created_at") if isinstance(investigation, dict) else None)
        )

    # 1. PROCESS EVIDENCE RECORDS
    for raw_ev in evidence_records:
        if isinstance(raw_ev, dict):
            ev = raw_ev
        elif hasattr(raw_ev, "__table__"):
            ev = {c.name: getattr(raw_ev, c.name, None) for c in raw_ev.__table__.columns}
        else:
            ev = {k: getattr(raw_ev, k, None) for k in dir(raw_ev) if not k.startswith("_") and not callable(getattr(raw_ev, k, None))}

        ev_id = ev.get("id") or f"EVD-{uuid.uuid4().hex[:8].upper()}"
        platform = ev.get("source_platform") or "web"
        source_url = ev.get("source_url") or ""
        raw_title = ev.get("title_or_caption") or source_url or "Discovered Evidence Item"
        author = ev.get("author_name") or ev.get("author_handle")

        # Parse distinct timestamps
        pub_dt = parse_iso_or_any_timestamp(ev.get("reported_published_at") or ev.get("reported_created_at"))
        arch_dt = parse_iso_or_any_timestamp(ev.get("wayback_capture_at"))
        retr_dt = parse_iso_or_any_timestamp(ev.get("retrieved_at") or ev.get("created_at"))
        prim_dt = parse_iso_or_any_timestamp(ev.get("primary_timestamp"))

        # Harmonize with primary_timestamp if specified
        if prim_dt:
            ts_type_hint = ev.get("timestamp_type", "")
            if ts_type_hint == "source_publication" and not pub_dt:
                pub_dt = prim_dt
            elif ts_type_hint == "archive_capture" and not arch_dt:
                arch_dt = prim_dt
            elif ts_type_hint == "retrieval_only" and not retr_dt:
                retr_dt = prim_dt
            elif not pub_dt and not arch_dt and not retr_dt:
                # Default fallback
                retr_dt = prim_dt

        media_urls = ev.get("media_urls") or []
        cand_img = ev.get("candidate_image_url") or (media_urls[0] if media_urls else None)
        cand_thumb = ev.get("candidate_thumbnail_path") or ev.get("candidate_thumbnail_url")

        norm_url = validate_and_normalize_source_url(source_url, raw_title, platform)
        clean_url = norm_url["clean_url"] if norm_url["is_valid"] else source_url
        if norm_url["is_direct_image"] and not cand_img:
            cand_img = clean_url

        signals = ev.get("match_signals") or {}
        search_prov = signals.get("search_provider") or ("Google Lens (SerpApi)" if platform == "reverse_image" else ("Internet Archive" if platform == "wayback" else platform))
        disc_method = signals.get("discovery_method") or ("visual_search" if platform == "reverse_image" else ("cdx_snapshot" if platform == "wayback" else "text_query"))

        base_item = {
            "id": ev_id,
            "evidence_id": ev_id,
            "platform": platform,
            "url": clean_url,
            "original_raw_url": source_url,
            "source_domain": norm_url["domain"],
            "url_type": norm_url["url_type"],
            "is_direct_image": norm_url["is_direct_image"],
            "fallback_search_url": norm_url["fallback_search_url"],
            "fallback_query": norm_url["fallback_query"],
            "access_status": ev.get("access_status", "accessible" if norm_url["is_valid"] else "malformed"),
            "search_provider": search_prov,
            "discovery_method": disc_method,
            "title": raw_title,
            "author": author,
            "match_type": ev.get("match_type", "match"),
            "evidence_strength": ev.get("evidence_strength", "Inconclusive"),
            "composite_score": float(ev.get("composite_score") or 0.0),
            "visual_similarity": float(ev.get("visual_similarity")) if ev.get("visual_similarity") is not None else None,
            "text_relevance": float(ev.get("text_relevance")) if ev.get("text_relevance") is not None else None,
            "explanation": ev.get("explanation"),
            "media_urls": media_urls,
            "candidate_image_url": cand_img,
            "candidate_thumbnail_path": cand_thumb,
            "ambiguity_notes": ev.get("ambiguity_notes"),
            "published_at": format_iso_timestamp(pub_dt),
            "archived_at": format_iso_timestamp(arch_dt),
            "retrieved_at": format_iso_timestamp(retr_dt),
            "investigation_created_at": format_iso_timestamp(inv_created_at_dt),
            "is_earliest": False
        }

        # CATEGORY A: Dated source evidence (Publication Date)
        # CATEGORY A1: C2PA Content Credentials Provenance Verification
        if platform == "c2pa" or ev.get("timestamp_type") == "provenance_verification":
            item = dict(base_item)
            item["event_type"] = "provenance_verification"
            ts_to_use = pub_dt or prim_dt or retr_dt
            item["event_timestamp"] = format_iso_timestamp(ts_to_use)
            item["timestamp"] = format_iso_timestamp(ts_to_use)
            item["timestamp_type"] = "provenance_verification"
            item["reliability"] = ev.get("timestamp_reliability") or "high"
            item["timestamp_provenance"] = "C2PA Content Credentials cryptographic manifest"
            item["uncertainty"] = (
                ev.get("ambiguity_notes")
                or "Cryptographically signed manifest. Does not independently guarantee real-world truth of depicted scene."
            )
            dated_events.append(item)
            provenance_events.append(item)

        # CATEGORY A2: Dated source evidence (Publication Date)
        elif pub_dt:
            item = dict(base_item)
            item["event_type"] = "source_publication"
            item["event_timestamp"] = format_iso_timestamp(pub_dt)
            item["timestamp"] = format_iso_timestamp(pub_dt)
            item["timestamp_type"] = "source_publication"
            item["reliability"] = ev.get("timestamp_reliability") or "high"
            item["timestamp_provenance"] = "Attributable post publication or creation timestamp"
            item["uncertainty"] = (
                ev.get("ambiguity_notes")
                or "Attributable source post timestamp. Subject to account platform time-synchronization."
            )
            dated_events.append(item)
            source_events.append(item)

        # CATEGORY A3: Dated archive snapshot (Wayback Capture Date)
        elif arch_dt or platform == "wayback":
            item = dict(base_item)
            item["event_type"] = "archive_capture"
            item["event_timestamp"] = format_iso_timestamp(arch_dt)
            item["timestamp"] = format_iso_timestamp(arch_dt)
            item["timestamp_type"] = "archive_capture"
            item["reliability"] = ev.get("timestamp_reliability") or "medium"
            item["timestamp_provenance"] = "Internet Archive Wayback Machine crawl snapshot"
            item["uncertainty"] = (
                ev.get("ambiguity_notes")
                or "Archive snapshot date reflects web crawler crawl time, not original author publication date."
            )
            dated_events.append(item)
            archive_events.append(item)

        # CATEGORY B: Evidence collection event (Has retrieval time, but NO publication date)
        elif retr_dt:
            item = dict(base_item)
            item["event_type"] = "evidence_collection"
            item["event_timestamp"] = format_iso_timestamp(retr_dt)
            item["timestamp"] = format_iso_timestamp(retr_dt)
            item["timestamp_type"] = "retrieval_only"
            item["reliability"] = "verified_collection"
            item["timestamp_provenance"] = "Discovered and recorded by OriginTrace AI workbench"
            item["title"] = f"Evidence collected by OriginTrace: {raw_title}"
            item["uncertainty"] = (
                "No historical publication timestamp metadata was discovered for this source. "
                "Recorded timestamp is the moment OriginTrace collected the evidence. "
                "Does NOT represent original content creation date."
            )
            dated_events.append(item)
            collection_events.append(item)

        # CATEGORY C: Undated evidence (No publication, archive, or collection timestamp)
        else:
            item = dict(base_item)
            item["event_type"] = "undated_evidence"
            item["event_timestamp"] = None
            item["timestamp"] = None
            item["timestamp_type"] = "undated"
            item["reliability"] = "unverified"
            item["timestamp_provenance"] = "No usable timestamp metadata available"
            item["uncertainty"] = "Undated evidence candidate. No historical or retrieval timestamps recorded."
            undated_events.append(item)

    # 2. PROCESS SYSTEM PROCESSING EVENTS (CATEGORY D)
    if include_processing_events:
        # A. Investigation Initialized
        if inv_created_at_dt:
            proc_init = {
                "id": f"PROC-INIT-{inv_id[-6:] if inv_id else '001'}",
                "evidence_id": None,
                "platform": "system",
                "url": None,
                "title": "Investigation Intake Initialized",
                "author": "OriginTrace AI",
                "event_type": "processing",
                "event_timestamp": format_iso_timestamp(inv_created_at_dt),
                "timestamp": format_iso_timestamp(inv_created_at_dt),
                "timestamp_type": "processing",
                "reliability": "high",
                "timestamp_provenance": "Internal audit log: investigation registration",
                "match_type": "system_event",
                "evidence_strength": "System event",
                "composite_score": 1.0,
                "explanation": "Case inquiry registered and forensic pipeline commenced.",
                "uncertainty": "Internal system execution event.",
                "is_earliest": False
            }
            processing_events.append(proc_init)
            dated_events.append(proc_init)

        # B. Asset Hashed & Registered
        if assets:
            for idx, a in enumerate(assets):
                a_created = parse_iso_or_any_timestamp(getattr(a, "created_at", None)) or inv_created_at_dt
                if a_created:
                    sha = getattr(a, "sha256", None) or "N/A"
                    phash = getattr(a, "perceptual_hash", None) or "N/A"
                    w = getattr(a, "image_width", None)
                    h = getattr(a, "image_height", None)
                    dim_str = f" ({w}x{h} px)" if w and h else ""
                    
                    proc_asset = {
                        "id": f"PROC-ASSET-{getattr(a, 'id', str(idx))[-6:]}",
                        "evidence_id": None,
                        "platform": "system",
                        "url": None,
                        "title": f"Evidence Asset Ingested & Hashed{dim_str}",
                        "author": "OriginTrace Forensics Engine",
                        "event_type": "processing",
                        "event_timestamp": format_iso_timestamp(a_created),
                        "timestamp": format_iso_timestamp(a_created),
                        "timestamp_type": "processing",
                        "reliability": "high",
                        "timestamp_provenance": "Cryptographic bitstream digest computation",
                        "match_type": "system_event",
                        "evidence_strength": "System event",
                        "composite_score": 1.0,
                        "explanation": f"Computed SHA-256 ({sha[:16]}...) and perceptual hash ({phash[:16]}...).",
                        "uncertainty": "Internal cryptographic operation.",
                        "is_earliest": False
                    }
                    processing_events.append(proc_asset)
                    dated_events.append(proc_asset)

                # Camera EXIF Hardware Capture Time (if present in asset)
                exif_time = getattr(a, "capture_time", None)
                if exif_time:
                    exif_dt = parse_iso_or_any_timestamp(exif_time)
                    if exif_dt:
                        camera = f"{getattr(a, 'camera_make', '')} {getattr(a, 'camera_model', '')}".strip() or "Digital Camera"
                        proc_exif = {
                            "id": f"EXIF-{getattr(a, 'id', '0')[-6:]}",
                            "evidence_id": None,
                            "platform": "camera_hardware",
                            "url": None,
                            "title": f"Camera EXIF Capture Timestamp: {camera}",
                            "author": camera,
                            "event_type": "source_publication",
                            "event_timestamp": format_iso_timestamp(exif_dt),
                            "timestamp": format_iso_timestamp(exif_dt),
                            "timestamp_type": "source_publication",
                            "reliability": "medium",
                            "timestamp_provenance": "Embedded EXIF camera hardware clock metadata",
                            "match_type": "hardware_metadata",
                            "evidence_strength": "Strong match",
                            "composite_score": 0.95,
                            "explanation": f"Hardware EXIF clock recorded capture time: {exif_time}.",
                            "uncertainty": "Camera hardware clocks may be set manually, inaccurate, or desynchronized.",
                            "is_earliest": False
                        }
                        dated_events.append(proc_exif)
                        source_events.append(proc_exif)

                # C2PA Provenance Manifest Verification (if present in asset)
                c2pa_stat = getattr(a, "c2pa_status", None)
                c2pa_data = getattr(a, "c2pa_data", None) or {}
                if c2pa_data and c2pa_data.get("has_manifest"):
                    signed_dt = parse_iso_or_any_timestamp(c2pa_data.get("signed_at"))
                    claim_gen = c2pa_data.get("claim_generator") or "C2PA Signer"
                    author_or_issuer = c2pa_data.get("author") or c2pa_data.get("issuer") or "C2PA Signer"
                    c2pa_title = f"C2PA Content Credentials: {c2pa_data.get('status_label', 'Manifest Detected')}"
                    proc_c2pa = {
                        "id": f"C2PA-{getattr(a, 'id', '0')[-6:]}",
                        "evidence_id": None,
                        "platform": "c2pa",
                        "url": None,
                        "title": c2pa_title,
                        "author": author_or_issuer,
                        "event_type": "provenance_verification",
                        "event_timestamp": format_iso_timestamp(signed_dt) if signed_dt else format_iso_timestamp(a_created),
                        "timestamp": format_iso_timestamp(signed_dt) if signed_dt else format_iso_timestamp(a_created),
                        "timestamp_type": "provenance_verification",
                        "reliability": "high" if c2pa_stat == "verified" else "medium",
                        "timestamp_provenance": "Cryptographically signed C2PA manifest timestamp" if signed_dt else "Verified during evidence intake",
                        "match_type": "cryptographic_provenance",
                        "evidence_strength": "Cryptographic proof" if c2pa_stat == "verified" else "Cryptographic assertion",
                        "composite_score": 1.0 if c2pa_stat == "verified" else 0.85,
                        "explanation": c2pa_data.get("explanation") or f"Manifest produced by {claim_gen}.",
                        "uncertainty": "Cryptographic validity certifies data integrity since signing, but does not independently establish real-world factual claims.",
                        "is_earliest": False
                    }
                    dated_events.append(proc_c2pa)
                    provenance_events.append(proc_c2pa)

        # C. Connector Execution Searches
        if logs:
            for l in logs:
                l_started = parse_iso_or_any_timestamp(getattr(l, "started_at", None))
                if l_started:
                    c_name = getattr(l, "connector_name", "connector")
                    status = getattr(l, "status", "completed")
                    res_cnt = getattr(l, "results_count", 0)
                    proc_conn = {
                        "id": f"PROC-LOG-{getattr(l, 'id', str(uuid.uuid4()))[-6:]}",
                        "evidence_id": None,
                        "platform": c_name,
                        "url": None,
                        "title": f"Discovery Search Executed: {c_name.replace('_', ' ').title()}",
                        "author": "OriginTrace Discovery Engine",
                        "event_type": "processing",
                        "event_timestamp": format_iso_timestamp(l_started),
                        "timestamp": format_iso_timestamp(l_started),
                        "timestamp_type": "processing",
                        "reliability": "high",
                        "timestamp_provenance": "Discovery connector query execution log",
                        "match_type": "system_event",
                        "evidence_strength": "System event",
                        "composite_score": 1.0,
                        "explanation": f"Connector status: {status}. Located {res_cnt} candidate evidence items.",
                        "uncertainty": "Internal connector execution log.",
                        "is_earliest": False
                    }
                    processing_events.append(proc_conn)
                    dated_events.append(proc_conn)

    # 3. DEDUPLICATE & SORT DATED EVENTS CHRONOLOGICALLY
    unique_dated: List[Dict[str, Any]] = []
    seen_keys = set()
    for ev in dated_events:
        ts_val = ev.get("timestamp") or ev.get("event_timestamp")
        dedup_key = (ev.get("event_type"), ev.get("evidence_id") or ev.get("id"), ts_val)
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)
        unique_dated.append(ev)

    # Sort strictly by timestamp ascending (UTC) using safe datetime parsing
    unique_dated.sort(
        key=lambda x: parse_iso_or_any_timestamp(x.get("event_timestamp") or x.get("timestamp"))
        or datetime.min.replace(tzinfo=timezone.utc)
    )

    # 4. SELECT EARLIEST DISCOVERED MATCHING REFERENCE
    earliest_reference = None

    # First priority: Look for candidates with attributable publication or archive dates
    attributable_candidates = [
        e for e in unique_dated
        if e.get("event_type") in ("source_publication", "archive_capture")
        and e.get("evidence_id")
    ]

    if attributable_candidates:
        attributable_candidates[0]["is_earliest"] = True
        cand = attributable_candidates[0]
        earliest_reference = {
            "evidence_id": cand["evidence_id"],
            "platform": cand["platform"],
            "url": cand["url"],
            "original_raw_url": cand.get("original_raw_url"),
            "source_domain": cand.get("source_domain"),
            "fallback_search_url": cand.get("fallback_search_url"),
            "candidate_image_url": cand.get("candidate_image_url"),
            "timestamp": cand["timestamp"],
            "timestamp_type": cand["timestamp_type"],
            "reliability": cand["reliability"],
            "author": cand.get("author"),
            "title": cand.get("title"),
            "evidence_strength": cand.get("evidence_strength", "Inconclusive"),
            "ambiguity_notes": (
                cand.get("ambiguity_notes")
                or "Earliest located matching candidate among searched sources. Does not establish original creator copyright."
            )
        }
    elif collection_events:
        # Fallback when only collection timestamps exist
        collection_events[0]["is_earliest"] = True
        cand = collection_events[0]
        earliest_reference = {
            "evidence_id": cand["evidence_id"],
            "platform": cand["platform"],
            "url": cand["url"],
            "original_raw_url": cand.get("original_raw_url"),
            "source_domain": cand.get("source_domain"),
            "fallback_search_url": cand.get("fallback_search_url"),
            "candidate_image_url": cand.get("candidate_image_url"),
            "timestamp": cand["timestamp"],
            "timestamp_type": "retrieval_only",
            "reliability": "verified_collection",
            "author": cand.get("author"),
            "title": cand.get("title"),
            "evidence_strength": cand.get("evidence_strength", "Inconclusive"),
            "ambiguity_notes": (
                "Earliest collection by OriginTrace. No prior publication or archive timestamp metadata "
                "was discovered across queried sources. Does not establish original creator copyright."
            )
        }
    elif unique_dated:
        # If only processing events exist
        unique_dated[0]["is_earliest"] = True

    # 5. GENERATE STRUCTURED WARNINGS
    if len(collection_events) > 0 and len(source_events) == 0:
        warnings.append(
            f"{len(collection_events)} discovered evidence candidates lack source publication timestamps and are displayed as collection events."
        )
    if len(undated_events) > 0:
        warnings.append(
            f"{len(undated_events)} evidence candidates could not be associated with a valid timestamp and are displayed in the Undated Evidence section."
        )

    return {
        "investigation_id": inv_id,
        "timeline_events": unique_dated,
        "undated_events": undated_events,
        "collection_events": collection_events,
        "source_events": source_events,
        "archive_events": archive_events,
        "provenance_events": provenance_events,
        "processing_events": processing_events,
        "total_events": len(unique_dated) + len(undated_events),
        "dated_events_count": len(unique_dated),
        "undated_events_count": len(undated_events),
        "earliest_discovered_reference": earliest_reference,
        "warnings": warnings,
        "coverage_limitations": limitations
    }
