import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ToastContainer } from './components/ToastContainer';
import { ReceiptModal } from './components/ReceiptModal';
import { OverviewPage } from './pages/OverviewPage';
import { ManifestPage } from './pages/ManifestPage';
import { ScannerPage } from './pages/ScannerPage';
import { VacanciesPage } from './pages/VacanciesPage';
import { FinesPage } from './pages/FinesPage';
import { OperationsPage } from './pages/OperationsPage';
import { CrowdCleanPage } from './pages/CrowdCleanPage';
import { EmergencyPage } from './pages/EmergencyPage';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [scannerPrefillPnr, setScannerPrefillPnr] = useState<string>('');
  const [finePrefill, setFinePrefill] = useState<{ name: string; idRef: string; reason: string } | null>(null);

  const handleInspectPassenger = (pnr: string) => {
    setScannerPrefillPnr(pnr);
    setActiveTab('scanner');
  };

  const handleIssueFinePrefill = (name: string, idRef: string, reason: string) => {
    setFinePrefill({ name, idRef, reason });
    setActiveTab('fines');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans">
      {/* Sidebar - Matching Admin Style */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area - Matching Admin Style */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <Header onOpenScanner={() => setActiveTab('scanner')} />

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === 'overview' && <OverviewPage setActiveTab={setActiveTab} />}
          {activeTab === 'manifest' && <ManifestPage onInspectPassenger={handleInspectPassenger} />}
          {activeTab === 'scanner' && (
            <ScannerPage
              initialPnr={scannerPrefillPnr}
              onIssueFinePrefill={handleIssueFinePrefill}
            />
          )}
          {activeTab === 'vacancies' && <VacanciesPage />}
          {activeTab === 'fines' && (
            <FinesPage
              prefillName={finePrefill?.name || ''}
              prefillIdRef={finePrefill?.idRef || ''}
              prefillReason={finePrefill?.reason || 'TICKETLESS_TRAVEL'}
            />
          )}
          {activeTab === 'operations' && <OperationsPage />}
          {activeTab === 'crowd_clean' && <CrowdCleanPage />}
          {activeTab === 'emergency' && <EmergencyPage />}
        </main>
      </div>

      {/* Modal & Toast Overlays */}
      <ReceiptModal />
      <ToastContainer />
    </div>
  );
};
