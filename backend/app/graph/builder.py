import networkx as nx
from typing import List, Dict, Any, Optional

def build_origin_graph(
    investigation_id: str,
    investigation_title: str,
    input_type: str,
    evidence_records: List[Dict[str, Any]],
    earliest_reference_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Constructs an evidence network graph connecting the investigated artifact,
    discovered sources, authors, captures, and semantic/visual relationships.
    """
    G = nx.DiGraph()

    # 1. Root / Investigated Item Node
    root_id = f"input_{investigation_id}"
    G.add_node(
        root_id,
        label=investigation_title[:40],
        node_type="input",
        platform="target_artifact",
        evidence_strength="Origin Input",
        data={
            "input_type": input_type,
            "title": investigation_title,
        }
    )

    # 2. Iterate through evidence records
    for ev in evidence_records:
        ev_id = ev.get("id")
        platform = ev.get("source_platform", "web")
        match_type = ev.get("match_type", "match")
        strength = ev.get("evidence_strength", "Inconclusive")
        is_earliest = bool(ev_id == earliest_reference_id)
        primary_ts = ev.get("primary_timestamp")
        ts_str = primary_ts.isoformat() if hasattr(primary_ts, "isoformat") else (str(primary_ts) if primary_ts else None)

        node_label = f"[{platform.upper()}] " + (ev.get("author_handle") or ev.get("author_name") or ev.get("title_or_caption") or ev_id)[:25]

        G.add_node(
            ev_id,
            label=node_label,
            node_type="archive" if platform == "wayback" else "post",
            platform=platform,
            timestamp=ts_str,
            url=ev.get("source_url"),
            evidence_strength=strength,
            is_earliest=is_earliest,
            data={
                "author": ev.get("author_name") or ev.get("author_handle"),
                "composite_score": ev.get("composite_score", 0.0),
                "timestamp_type": ev.get("timestamp_type"),
                "match_signals": ev.get("match_signals", {}),
                "content_snippet": (ev.get("content_snippet") or "")[:200]
            }
        )

        # Edge from Root to Evidence
        edge_relation = "visual_similarity"
        edge_label = f"{strength}"
        if match_type == "exact":
            edge_relation = "exact_duplicate"
            edge_label = "Exact SHA256 Match"
        elif match_type == "archive_capture":
            edge_relation = "archive_capture"
            edge_label = "Wayback Historical Snapshot"
        elif match_type == "semantic_claim":
            edge_relation = "same_claim"
            edge_label = "Semantic Text Claim"

        G.add_edge(
            root_id,
            ev_id,
            id=f"edge_{root_id}_{ev_id}",
            relation_type=edge_relation,
            label=edge_label,
            weight=ev.get("composite_score", 0.5),
            evidence_notes=ev.get("ambiguity_notes")
        )

        # 3. Author Node if handle is present
        author_handle = ev.get("author_handle")
        if author_handle:
            author_node_id = f"author_{platform}_{author_handle}"
            if not G.has_node(author_node_id):
                G.add_node(
                    author_node_id,
                    label=author_handle,
                    node_type="author",
                    platform=platform,
                    data={"handle": author_handle, "platform": platform}
                )
            G.add_edge(
                ev_id,
                author_node_id,
                id=f"edge_{ev_id}_{author_node_id}",
                relation_type="posted_by",
                label="Published by",
                weight=1.0
            )

    # Convert to serialized dictionary for React Flow
    nodes = []
    for node_id, attrs in G.nodes(data=True):
        nodes.append({
            "id": node_id,
            "label": attrs.get("label", node_id),
            "node_type": attrs.get("node_type", "post"),
            "platform": attrs.get("platform"),
            "timestamp": attrs.get("timestamp"),
            "url": attrs.get("url"),
            "evidence_strength": attrs.get("evidence_strength"),
            "is_earliest": attrs.get("is_earliest", False),
            "data": attrs.get("data", {})
        })

    edges = []
    for u, v, attrs in G.edges(data=True):
        edges.append({
            "id": attrs.get("id", f"e_{u}_{v}"),
            "source": u,
            "target": v,
            "relation_type": attrs.get("relation_type", "related"),
            "label": attrs.get("label", "Related"),
            "weight": attrs.get("weight", 1.0),
            "evidence_notes": attrs.get("evidence_notes")
        })

    return {
        "investigation_id": investigation_id,
        "nodes": nodes,
        "edges": edges,
        "total_nodes": len(nodes),
        "total_edges": len(edges)
    }
