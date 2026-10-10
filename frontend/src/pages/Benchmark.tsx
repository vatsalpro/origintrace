import React, { useState } from 'react';
import {
  ShieldCheck,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  TrendingUp,
  Cpu,
  Layers,
  Clock
} from 'lucide-react';
import { api } from '../services/api';
import { BenchmarkSuiteResult } from '../types';

export const Benchmark: React.FC = () => {
  const [result, setResult] = useState<BenchmarkSuiteResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunBenchmark = async () => {
    setRunning(true);
    setError(null);
    try {
      const data = await api.runBenchmark();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Benchmark run failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Digital Forensics Benchmark Suite</h2>
          <p className="text-sm text-slate-400 font-mono mt-1">
            Deterministic ground-truth evaluation measuring precision, recall, and earliest-reference reconstruction accuracy
          </p>
        </div>

        <button
          onClick={handleRunBenchmark}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-sky-500/20 disabled:opacity-50"
        >
          {running ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              <span>Evaluating Dataset...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Execute Benchmark Suite</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Benchmark Summary Metrics */}
      {result ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#111827] border border-[#1e293b] p-5 rounded-xl space-y-1">
              <span className="text-[11px] font-mono uppercase text-slate-400">Match Precision</span>
              <div className="text-3xl font-extrabold text-emerald-400">
                {Math.round(result.metrics.precision * 100)}%
              </div>
              <span className="text-[10px] text-slate-500 font-mono block">Zero false positive matches</span>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] p-5 rounded-xl space-y-1">
              <span className="text-[11px] font-mono uppercase text-slate-400">Match Recall</span>
              <div className="text-3xl font-extrabold text-sky-400">
                {Math.round(result.metrics.recall * 100)}%
              </div>
              <span className="text-[10px] text-slate-500 font-mono block">Identified transformed copies</span>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] p-5 rounded-xl space-y-1">
              <span className="text-[11px] font-mono uppercase text-slate-400">False Match Rate</span>
              <div className="text-3xl font-extrabold text-purple-400">
                {Math.round(result.metrics.false_match_rate * 100)}%
              </div>
              <span className="text-[10px] text-slate-500 font-mono block">Negative controls rejected</span>
            </div>

            <div className="bg-[#111827] border border-[#1e293b] p-5 rounded-xl space-y-1">
              <span className="text-[11px] font-mono uppercase text-slate-400">Earliest Source Accuracy</span>
              <div className="text-3xl font-extrabold text-amber-400">
                {Math.round(result.metrics.earliest_known_source_accuracy * 100)}%
              </div>
              <span className="text-[10px] text-slate-500 font-mono block">Ground truth origin resolved</span>
            </div>
          </div>

          {/* Test Cases Overview */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white border-b border-[#1e293b] pb-3">
              Synthetic Test Cases Evaluated ({result.dataset_size})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
              {result.test_cases.map((tc, idx) => (
                <div key={idx} className="bg-[#182235] p-3 rounded-lg border border-[#1e293b] flex items-center gap-2 text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{tc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ground Truth Records Table */}
          <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden space-y-4">
            <div className="p-6 pb-0">
              <h3 className="text-base font-semibold text-white">Evaluated Dataset Verification</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#182235] text-slate-400 uppercase text-[11px] border-b border-[#1e293b]">
                  <tr>
                    <th className="p-3.5">Record ID</th>
                    <th className="p-3.5">Platform</th>
                    <th className="p-3.5">Predicted Strength</th>
                    <th className="p-3.5">Score</th>
                    <th className="p-3.5">pHash Dist</th>
                    <th className="p-3.5">Ground Truth Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b] text-slate-300">
                  {result.evaluated_records.map((r, i) => (
                    <tr key={i} className="hover:bg-[#182235]/40 transition">
                      <td className="p-3.5 font-bold text-sky-400">{r.id}</td>
                      <td className="p-3.5 uppercase">{r.source_platform}</td>
                      <td className="p-3.5 font-semibold text-white">{r.evidence_strength}</td>
                      <td className="p-3.5">{Math.round((r.composite_score || 0) * 100)}%</td>
                      <td className="p-3.5">{r.match_signals?.phash_distance ?? 'N/A'}</td>
                      <td className="p-3.5">
                        {r.is_ground_truth_origin ? (
                          <span className="text-emerald-400 font-bold">TRUE ORIGIN REF</span>
                        ) : (
                          <span className="text-slate-400">Variant Copy</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Methodological Notice */}
          <div className="p-4 rounded-xl bg-[#182235] border border-[#1e293b] text-xs font-mono text-slate-400 space-y-1">
            <span className="font-bold text-amber-400 block uppercase">Benchmark Methodological Notice:</span>
            <p className="leading-relaxed">{result.methodological_notice}</p>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-[#111827] border border-[#1e293b] rounded-xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-white">Execute Scientific Forensic Benchmark</h3>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Click 'Execute Benchmark Suite' to test the matching engine against controlled synthetic images, scaled variants, altered captions, and negative controls.
          </p>
          <button
            onClick={handleRunBenchmark}
            disabled={running}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 text-slate-950 font-bold text-sm hover:bg-sky-400 transition"
          >
            <Play className="w-4 h-4" /> Start Evaluation Suite
          </button>
        </div>
      )}
    </div>
  );
};
