import React, { useState, useEffect } from 'react';
import {
  Share2,
  ExternalLink,
  Shield,
  Layers,
  Info,
  Calendar,
  User,
  Archive,
  FileCheck
} from 'lucide-react';
import { api } from '../services/api';
import { OriginGraphData, GraphNode, GraphEdge } from '../types';

interface OriginGraphProps {
  investigationId?: string;
}

export const OriginGraph: React.FC<OriginGraphProps> = ({ investigationId }) => {
  const [graphData, setGraphData] = useState<OriginGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (!investigationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getInvestigationGraph(investigationId)
      .then((data) => {
        setGraphData(data);
        if (data.nodes.length > 0) {
          // Default select root node or earliest
          const earliest = data.nodes.find((n) => n.is_earliest) || data.nodes[0];
          setSelectedNode(earliest);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [investigationId]);

  if (!investigationId) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono">
        Please select an active investigation to inspect the origin network graph.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-sky-400 font-mono flex items-center justify-center gap-2">
        <Share2 className="w-5 h-5 animate-spin" />
        <span>Synthesizing multi-platform evidence relationship graph...</span>
      </div>
    );
  }

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  const filteredNodes = nodes.filter((n) => {
    if (filterType === 'all') return true;
    return n.node_type === filterType || n.platform === filterType;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Interactive Evidence & Provenance Graph</h2>
          <p className="text-sm text-slate-400 font-mono mt-1">
            Case {investigationId} — Node relationships connecting target asset, discovered posts, archives, and authors
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>Filter Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[#182235] border border-[#1e293b] rounded px-3 py-1.5 text-slate-200 text-xs"
          >
            <option value="all">All Elements</option>
            <option value="post">Posts & Social Media</option>
            <option value="archive">Wayback Captures</option>
            <option value="author">Identified Authors</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Interactive Network Canvas on Left, Node Inspector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Network Visual Canvas */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1e293b] rounded-xl p-6 min-h-[500px] flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-3 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>Evidence Nodes ({filteredNodes.length}) | Connections ({edges.length})</span>
            </span>
            <span className="text-slate-500">Click node to inspect forensic details</span>
          </div>

          {/* Interactive Node Matrix Visualizer */}
          <div className="py-8 flex flex-wrap items-center justify-center gap-6">
            {filteredNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isRoot = node.node_type === 'input';
              const isEarliest = node.is_earliest;

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className={`cursor-pointer p-4 rounded-xl border-2 transition-all max-w-xs shadow-lg flex flex-col items-center text-center gap-2 ${
                    isSelected
                      ? 'border-sky-400 bg-sky-500/10 shadow-sky-500/20 scale-105'
                      : isRoot
                      ? 'border-slate-500 bg-[#182235] hover:border-slate-400'
                      : isEarliest
                      ? 'border-emerald-500/60 bg-emerald-500/10 hover:border-emerald-400'
                      : 'border-[#1e293b] bg-[#182235]/60 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isEarliest
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : isRoot
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'bg-[#1f2d47] text-slate-300'
                    }`}
                  >
                    {node.node_type === 'author' ? (
                      <User className="w-5 h-5" />
                    ) : node.node_type === 'archive' ? (
                      <Archive className="w-5 h-5" />
                    ) : (
                      <FileCheck className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <span className="text-xs font-bold text-white block line-clamp-1">
                      {node.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      {node.platform || node.node_type}
                    </span>
                  </div>

                  {isEarliest && (
                    <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Earliest Reference
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Relationship Legend */}
          <div className="pt-4 border-t border-[#1e293b] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Target Input Item
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Earliest Discovered Appearance
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1f2d47]" /> Discovered Public Appearance
            </span>
          </div>
        </div>

        {/* Node Inspector Panel */}
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
            <h3 className="text-base font-semibold text-white">Node Evidence Inspector</h3>
            <Info className="w-4 h-4 text-sky-400" />
          </div>

          {selectedNode ? (
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Node Label</span>
                <p className="text-sm font-bold text-white pt-0.5">{selectedNode.label}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Node Category</span>
                  <p className="text-slate-200 font-mono font-semibold pt-0.5">{selectedNode.node_type.toUpperCase()}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Platform</span>
                  <p className="text-sky-400 font-mono font-semibold pt-0.5">{selectedNode.platform?.toUpperCase() || 'TARGET'}</p>
                </div>
              </div>

              {selectedNode.timestamp && (
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Primary Timestamp</span>
                  <p className="text-slate-200 font-mono pt-0.5">{new Date(selectedNode.timestamp).toUTCString()}</p>
                </div>
              )}

              {selectedNode.evidence_strength && (
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Evidence Match Strength</span>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded bg-[#182235] text-slate-200 font-mono font-semibold border border-[#1e293b]">
                    {selectedNode.evidence_strength}
                  </span>
                </div>
              )}

              {selectedNode.data?.content_snippet && (
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Content Snippet</span>
                  <p className="text-slate-300 bg-[#182235] p-3 rounded-lg border border-[#1e293b] mt-1 leading-relaxed">
                    {selectedNode.data.content_snippet}
                  </p>
                </div>
              )}

              {selectedNode.url && (
                <div className="pt-2">
                  <a
                    href={selectedNode.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Open Public Reference URL</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic py-8 text-center font-mono">
              Click any node in the graph to view its underlying forensic signals.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
