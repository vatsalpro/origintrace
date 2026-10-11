import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { IncognitoBanner } from './components/IncognitoBanner';
import { IncognitoProvider, useIncognito } from './context/IncognitoContext';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { NewInvestigation } from './pages/NewInvestigation';
import { EvidenceExplorer } from './pages/EvidenceExplorer';
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

function AppContent() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeInvestigation, setActiveInvestigation] = useState<Investigation | null>(null);

  const {
    isIncognito,
    incognitoInvestigations,
    activeIncognitoId,
    setActiveIncognitoId,
    refreshIncognitoInvestigations,
  } = useIncognito();

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

  // Compute effective investigation list and selected ID depending on mode
  const effectiveInvestigations = isIncognito ? incognitoInvestigations : investigations;
  const effectiveSelectedId = isIncognito ? (activeIncognitoId || incognitoInvestigations[0]?.id) : selectedId;

  useEffect(() => {
    if (!effectiveSelectedId) {
      setActiveInvestigation(null);
      return;
    }
    const found = effectiveInvestigations.find((i) => i.id === effectiveSelectedId);
    if (found) {
      setActiveInvestigation(found);
    } else {
      api.getInvestigation(effectiveSelectedId)
        .then((inv) => setActiveInvestigation(inv))
        .catch(() => setActiveInvestigation(null));
    }
  }, [effectiveSelectedId, isIncognito, incognitoInvestigations, investigations]);

  const currentInvestigation = activeInvestigation || effectiveInvestigations.find((i) => i.id === effectiveSelectedId);

  const handleSelectInvestigation = (id: string) => {
    if (isIncognito) {
      setActiveIncognitoId(id);
    } else {
      setSelectedId(id);
    }
  };

  const handleCreated = (id: string) => {
    if (isIncognito) {
      setActiveIncognitoId(id);
      refreshIncognitoInvestigations();
    } else {
      setSelectedId(id);
      loadData();
    }
  };

  return (
    <Routes>
      {/* Landing Page at root / (Preserved with 3D detective & hero) */}
      <Route
        path="/"
        element={
          <LandingPage
            investigations={effectiveInvestigations}
            selectedInvestigationId={effectiveSelectedId}
          />
        }
      />

      {/* Forensic Workbench Routes with Light-Theme Shell Layout */}
      <Route
        element={
          <div className="flex min-h-screen bg-[#F5F7FB] text-[#17243A] font-sans antialiased">
            <Sidebar
              activeInvestigationId={effectiveSelectedId}
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <Header
                investigations={investigations}
                selectedInvestigationId={effectiveSelectedId}
                activeInvestigation={currentInvestigation}
                onSelectInvestigation={handleSelectInvestigation}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              />

              {/* Incognito Notice Banner across Workbench */}
              <IncognitoBanner />

              <main className="flex-1 overflow-y-auto bg-[#F5F7FB]">
                <Outlet />
              </main>
            </div>
          </div>
        }
      >
        <Route
          path="/dashboard"
          element={
            <Dashboard
              investigations={investigations}
              connectors={connectors}
              onSelectInvestigation={handleSelectInvestigation}
            />
          }
        />
        <Route
          path="/new"
          element={<NewInvestigation onInvestigationCreated={handleCreated} />}
        />
        <Route
          path="/evidence"
          element={
            <EvidenceExplorer
              investigationId={effectiveSelectedId}
              investigation={currentInvestigation || undefined}
            />
          }
        />
        <Route
          path="/evidence-explorer"
          element={
            <EvidenceExplorer
              investigationId={effectiveSelectedId}
              investigation={currentInvestigation || undefined}
            />
          }
        />
        <Route
          path="/timeline"
          element={<EvidenceTimeline investigationId={effectiveSelectedId} />}
        />
        <Route
          path="/graph"
          element={<OriginGraph investigationId={effectiveSelectedId} />}
        />
        <Route
          path="/analysis"
          element={<ImageAnalysis investigation={currentInvestigation || undefined} />}
        />
        <Route path="/social-explorer" element={<SocialExplorer />} />
        <Route path="/archive-explorer" element={<ArchiveExplorer />} />
        <Route
          path="/reports"
          element={
            <Reports
              investigationId={effectiveSelectedId}
              investigation={currentInvestigation || undefined}
            />
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route path="/benchmark" element={<Benchmark />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <Router>
      <IncognitoProvider>
        <AppContent />
      </IncognitoProvider>
    </Router>
  );
}

export default App;
