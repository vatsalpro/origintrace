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
import { SourceLinkActions } from '../components/SourceLinkActions';
import { safeOpenExternalUrl } from '../utils/url';
import { MediaPreviewModal } from '../components/MediaPreviewModal';

interface OriginGraphProps {
  investigationId?: string;
}

export const OriginGraph: React.FC<OriginGraphProps> = ({ investigationId }) => {
  const [graphData, setGraphData] = useState<OriginGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [previewMedia, setPreviewMedia] = useState<{ url: string; title: string } | null>(null);

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
      <div className="p-12 text-center text-slate-500 font-mono bg-white border border-slate-200 rounded-2xl m-8 shadow-xs">
        <Share2 className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <h3 className="text-base font-semibold text-slate-900">No Investigation Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Please select an active investigation from the header to inspect its multi-platform evidence relationship graph.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-16 text-center text-blue-600 font-mono flex flex-col items-center justify-center gap-3">
        <Share2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-semibold text-slate-900">Synthesizing multi-platform evidence relationship graph...</span>
        <span className="text-xs text-slate-500">Case ID: {investigationId}</span>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Interactive Evidence & Provenance Graph</h2>
          <p className="text-sm text-slate-500 font-mono mt-1">
            Case {investigationId} — Node relationships connecting target asset, discovered posts, archives, and authors
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <span>Filter Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
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
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 min-h-[500px] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs font-mono text-slate-500">
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Evidence Nodes ({filteredNodes.length}) | Connections ({edges.length})</span>
            </span>
            <span className="text-slate-400">Click node to inspect forensic details</span>
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
                  className={`cursor-pointer p-4 rounded-xl border-2 transition-all max-w-xs shadow-xs flex flex-col items-center text-center gap-2 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-md scale-105'
                      : isRoot
                      ? 'border-slate-400 bg-slate-100 hover:border-slate-500'
                      : isEarliest
                      ? 'border-emerald-500 bg-emerald-50 hover:border-emerald-600'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isEarliest
                        ? 'bg-emerald-600 text-white font-bold'
                        : isRoot
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-200 text-slate-700'
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
                    <span className="text-xs font-bold text-slate-900 block line-clamp-1">
                      {node.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      {node.platform || node.node_type}
                    </span>
                  </div>

                  {isEarliest && (
                    <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Earliest Reference
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Relationship Legend */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Target Input Item
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Earliest Discovered Appearance
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Discovered Public Appearance
            </span>
          </div>
        </div>

        {/* Node Inspector Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-base font-semibold text-slate-900">Node Evidence Inspector</h3>
            <Info className="w-4 h-4 text-blue-600" />
          </div>

          {selectedNode ? (
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Node Label</span>
                <p
                  onClick={() => selectedNode.url && safeOpenExternalUrl(selectedNode.url, selectedNode.label)}
                  className={`text-sm font-bold text-slate-900 pt-0.5 ${
                    selectedNode.url ? 'hover:text-blue-600 hover:underline cursor-pointer' : ''
                  }`}
                  title={selectedNode.url ? `Open source: ${selectedNode.url}` : undefined}
                >
                  {selectedNode.label}
                </p>
              </div>

              {/* Candidate Image Preview in Inspector */}
              {(selectedNode.data?.candidate_image_url || selectedNode.data?.media_urls?.[0]) && (
                <div className="pt-1">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Associated Visual Asset</span>
                  <div
                    onClick={() =>
                      setPreviewMedia({
                        url: selectedNode.data?.candidate_image_url || selectedNode.data?.media_urls?.[0],
                        title: selectedNode.label
                      })
                    }
                    className="w-full h-32 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-400 transition group/img"
                    title="Click to preview asset"
                  >
                    <img
                      src={selectedNode.data?.candidate_image_url || selectedNode.data?.media_urls?.[0]}
                      alt={selectedNode.label}
                      className="max-h-full max-w-full object-contain group-hover/img:scale-105 transition duration-150"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Node Category</span>
                  <p className="text-slate-800 font-mono font-semibold pt-0.5">{selectedNode.node_type.toUpperCase()}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Platform</span>
                  <p className="text-blue-700 font-mono font-semibold pt-0.5">{selectedNode.platform?.toUpperCase() || 'TARGET'}</p>
                </div>
              </div>

              {selectedNode.timestamp && (
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Primary Timestamp</span>
                  <p className="text-slate-800 font-mono pt-0.5">{new Date(selectedNode.timestamp).toUTCString()}</p>
                </div>
              )}

              {selectedNode.evidence_strength && (
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Evidence Match Strength</span>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-semibold border border-slate-200">
                    {selectedNode.evidence_strength}
                  </span>
                </div>
              )}

              {selectedNode.data?.content_snippet && (
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Content Snippet</span>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-1 leading-relaxed">
                    {selectedNode.data.content_snippet}
                  </p>
                </div>
              )}

              {selectedNode.url && (
                <div className="pt-2">
                  <SourceLinkActions
                    sourceUrl={selectedNode.url}
                    sourceTitle={selectedNode.label}
                    sourcePlatform={selectedNode.platform}
                    candidateImageUrl={selectedNode.data?.candidate_image_url}
                    candidateThumbnailUrl={selectedNode.data?.candidate_thumbnail_path}
                    sourceDomain={selectedNode.data?.source_domain}
                    fallbackSearchUrl={selectedNode.data?.fallback_search_url}
                    fallbackQuery={selectedNode.data?.fallback_query}
                    urlType={selectedNode.data?.url_type}
                    isDirectImage={selectedNode.data?.is_direct_image}
                    searchProvider={selectedNode.data?.search_provider}
                    discoveryMethod={selectedNode.data?.discovery_method}
                    accessStatus={selectedNode.data?.access_status}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic py-8 text-center font-mono">
              Click any node in the graph to view its underlying forensic signals.
            </div>
          )}
        </div>
      </div>

      {/* Media Lightbox Preview Modal */}
      <MediaPreviewModal
        mediaUrl={previewMedia?.url || null}
        title={previewMedia?.title}
        onClose={() => setPreviewMedia(null)}
      />
    </div>
  );
};
