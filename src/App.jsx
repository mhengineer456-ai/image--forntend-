import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StatsCards from './components/StatsCards';
import LotRateManager from './components/LotRateManager';
import LotGarmentInspection from './components/LotGarmentInspection';
import SplashScreen from './components/SplashScreen';
import SecurityLock from './components/SecurityLock';
import AuditLogModal from './components/AuditLogModal';
import GoogleSheetsSettingsModal from './components/GoogleSheetsSettingsModal';
import { DEFAULT_SHEET_ID, DEFAULT_JOBORDER_SHEET_ID, DEFAULT_API_KEY } from './services/googleSheets';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isLocked, setIsLocked] = useState(true);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [activeTab, setActiveTab] = useState('inspection'); // Default landing page is LotGarmentInspection
  const [pendingTargetTab, setPendingTargetTab] = useState(null);

  const [masterPin, setMasterPin] = useState(() => {
    return localStorage.getItem('garment_vault_pin') || '123456';
  });

  const [apiKey, setApiKey] = useState(() => {
    const saved = localStorage.getItem('garment_vault_google_api_key');
    return (saved && saved.trim().length > 10 && saved !== 'YOUR_GOOGLE_API_KEY_HERE') ? saved : DEFAULT_API_KEY;
  });

  const [sheetId, setSheetId] = useState(() => {
    const saved = localStorage.getItem('garment_vault_sheet_id');
    return (saved && saved.trim() !== '') ? saved : DEFAULT_JOBORDER_SHEET_ID;
  });

  const [auditLogs, setAuditLogs] = useState(() => {
    const saved = localStorage.getItem('garment_vault_audit');
    return saved ? JSON.parse(saved) : [
      { action: 'System Security Initialized - Storage Ready', time: new Date().toLocaleString() }
    ];
  });

  useEffect(() => {
    localStorage.setItem('garment_vault_pin', masterPin);
  }, [masterPin]);

  useEffect(() => {
    localStorage.setItem('garment_vault_google_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('garment_vault_sheet_id', sheetId);
  }, [sheetId]);

  useEffect(() => {
    localStorage.setItem('garment_vault_audit', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const addAuditLog = (actionText) => {
    const newLog = {
      action: actionText,
      time: new Date().toLocaleString()
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const handleRequestTabChange = (targetTab) => {
    if (targetTab === 'rates' && isLocked) {
      setPendingTargetTab('rates');
      setShowSecurityModal(true);
    } else {
      setActiveTab(targetTab);
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
    setShowSecurityModal(false);
    if (pendingTargetTab) {
      setActiveTab(pendingTargetTab);
      setPendingTargetTab(null);
    } else {
      setActiveTab('rates');
    }
    addAuditLog('Master Security PIN Authenticated - Vault Unlocked');
  };

  const handleLock = () => {
    setIsLocked(true);
    setShowSecurityModal(false);
    setActiveTab('inspection'); // Automatically return to inspection page when locked
    addAuditLog('System Guard Activated - Vault Locked');
  };

  const handleUpdatePin = (newPin) => {
    setMasterPin(newPin);
    addAuditLog('Security Master PIN Changed Successfully');
  };

  const handleClearLogs = () => {
    setAuditLogs([]);
  };

  const [lotsState, setLotsState] = useState([]);

  return (
    <div className="app-container">

      {showSplash ? (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      ) : (
        <>
          <Navbar
            isLocked={isLocked}
            onToggleLock={() => setShowSecurityModal(true)}
            onOpenAudit={() => setShowAuditModal(true)}
            onTriggerSplash={() => setShowSplash(true)}
            onOpenApiSettings={() => setShowApiModal(true)}
            activeTab={activeTab}
            setActiveTab={handleRequestTabChange}
          />

          <main className="main-content">
            {activeTab === 'rates' && (
              <StatsCards lots={lotsState} isLocked={isLocked} />
            )}

            {activeTab === 'rates' ? (
              <LotRateManager
                isLocked={isLocked}
                onRequestUnlock={() => setShowSecurityModal(true)}
                addAuditLog={addAuditLog}
                onLotsUpdate={(updatedLots) => setLotsState(updatedLots)}
                apiKey={apiKey}
                sheetId={sheetId}
                onOpenApiSettings={() => setShowApiModal(true)}
              />
            ) : (
              <LotGarmentInspection
                lots={lotsState}
                isLocked={isLocked}
                onRequestUnlock={() => setShowSecurityModal(true)}
                addAuditLog={addAuditLog}
                apiKey={apiKey}
                sheetId={sheetId}
                onOpenApiSettings={() => setShowApiModal(true)}
              />
            )}
          </main>

          <footer className="no-print" style={{ borderTop: '1px solid var(--border-light)', background: '#ffffff', padding: '16px 24px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <div style={{ width: '100%', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <strong style={{ color: 'var(--accent-primary)' }}>Garment Rate Vault &copy; {new Date().getFullYear()}</strong> — Sheet ID: <span style={{ color: 'var(--text-main)' }}>{sheetId.slice(0, 12)}...</span>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>GOOGLE SHEETS INTEGRATED</span>
                <span>SYSTEM STATUS: OPERATIONAL</span>
              </div>
            </div>
          </footer>

          {showSecurityModal && (
            <SecurityLock
              isLocked={isLocked}
              onUnlock={handleUnlock}
              onLock={handleLock}
              masterPin={masterPin}
              onUpdatePin={handleUpdatePin}
              auditLogs={auditLogs}
            />
          )}

          <AuditLogModal
            isOpen={showAuditModal}
            onClose={() => setShowAuditModal(false)}
            logs={auditLogs}
            onClearLogs={handleClearLogs}
          />

          <GoogleSheetsSettingsModal
            isOpen={showApiModal}
            onClose={() => setShowApiModal(false)}
            apiKey={apiKey}
            setApiKey={setApiKey}
            sheetId={sheetId}
            setSheetId={setSheetId}
            addAuditLog={addAuditLog}
          />
        </>
      )}

    </div>
  );
}
