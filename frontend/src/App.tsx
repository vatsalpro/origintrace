import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { NewInvestigation } from './pages/NewInvestigation';
import { EvidenceTimeline } from './pages/EvidenceTimeline';
import { OriginGraph } from './pages/OriginGraph';
import { ImageAnalysis } from './pages/ImageAnalysis';
import { SocialExplorer } from './pages/SocialExplorer';
import { ArchiveExplorer } from './pages/ArchiveExplorer';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Benchmark } from './pages/Benchmark';
import { api } from './services/api';
import { Investigation, ConnectorStatus } from './types';

export function App() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);

  const loadData = () => {
    api.getInvestigations().then((invs) => {
      setInvestigations(invs);
      if (invs.length > 0 && !selectedId) {
        setSelectedId(invs[0].id);
      }
    }).catch(console.error);

    api.getConnectors().then((conns) => {
      setConnectors(conns);
    }).catch(console.error);
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedInvestigation = investigations.find((i) => i.id === selectedId);

  const handleCreated = (id: string) => {
    setSelectedId(id);
    loadData();
  };

  return (
    <Router>
      <div className="flex min-h-screen bg-[#0B1020] text-slate-100 font-sans">
        {/* Navigation Sidebar */}
        <Sidebar activeInvestigationId={selectedId} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header
            investigations={investigations}
            selectedInvestigationId={selectedId}
            onSelectInvestigation={(id) => setSelectedId(id)}
          />

          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route
                path="/"
                element={
                  <Dashboard
                    investigations={investigations}
                    connectors={connectors}
                    onSelectInvestigation={(id) => setSelectedId(id)}
                  />
                }
              />
              <Route
                path="/new"
                element={<NewInvestigation onInvestigationCreated={handleCreated} />}
              />
              <Route
                path="/timeline"
                element={<EvidenceTimeline investigationId={selectedId} />}
              />
              <Route
                path="/graph"
                element={<OriginGraph investigationId={selectedId} />}
              />
              <Route
                path="/analysis"
                element={<ImageAnalysis investigation={selectedInvestigation} />}
              />
              <Route path="/social-explorer" element={<SocialExplorer />} />
              <Route path="/archive-explorer" element={<ArchiveExplorer />} />
              <Route
                path="/reports"
                element={
                  <Reports
                    investigationId={selectedId}
                    investigation={selectedInvestigation}
                  />
                }
              />
              <Route path="/settings" element={<Settings />} />
              <Route path="/benchmark" element={<Benchmark />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
