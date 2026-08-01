import React, { useState, useEffect } from 'react';
import { Shield, Lock, Unlock, RefreshCw, FileText, Database, Menu, X, Layers, Camera, ChevronRight } from 'lucide-react';

export default function Navbar({ isLocked, onToggleLock, onOpenAudit, onTriggerSplash, activeTab, setActiveTab, onOpenApiSettings }) {
  const [timeString, setTimeString] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="navbar no-print">
      <div className="navbar-inner">

        {/* Brand Group */}
        <div className="brand-group">
          <div className="brand-icon-box">
            <Shield style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <h1 className="brand-title">GARMENT RATE VAULT</h1>
            <p className="brand-subtitle">Lot & Rate Management System</p>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Hidden on Mobile/Tablet < 900px) */}
        <div className="desktop-tabs">
          <button
            type="button"
            onClick={() => handleTabClick('inspection')}
            className={`tab-btn ${activeTab === 'inspection' ? 'tab-btn-active' : ''}`}
          >
            <Camera style={{ width: 15, height: 15 }} />
            <span>Photo & Oversize Inspection</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick('rates')}
            className={`tab-btn ${activeTab === 'rates' ? 'tab-btn-active' : ''}`}
            style={{ position: 'relative' }}
          >
            <Layers style={{ width: 15, height: 15 }} />
            <span>Garment Rate Manager</span>
            {isLocked && <Lock style={{ width: 12, height: 12, color: 'var(--accent-amber)', marginLeft: 4 }} />}
          </button>
        </div>

        {/* Desktop Right Action Controls (Hidden on Mobile < 900px) */}
        <div className="nav-actions desktop-actions">

          <div className="time-box font-mono">
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block' }}>SYSTEM TIME</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{timeString}</span>
          </div>

          {/* <button
            onClick={onOpenApiSettings}
            className="btn btn-outline nav-btn"
            title="Configure Sheets API & Sheet ID"
          >
            <Database style={{ width: 14, height: 14, color: 'var(--accent-primary)' }} />
            <span>Sheets API</span>
          </button> */}

          <button
            onClick={onTriggerSplash}
            className="btn btn-outline nav-btn"
            title="Re-run Splash Intro"
          >
            <RefreshCw style={{ width: 14, height: 14, color: 'var(--accent-cyan)' }} />
            <span>Splash</span>
          </button>

          <button
            onClick={onOpenAudit}
            className="btn btn-outline nav-btn"
            title="Security Audit Logs"
          >
            <FileText style={{ width: 14, height: 14, color: 'var(--accent-purple)' }} />
            <span>Audit Logs</span>
          </button>

          <button
            onClick={onToggleLock}
            className={`btn ${isLocked ? 'btn-outline' : 'btn-emerald'} lock-toggle-btn`}
            style={{
              borderColor: isLocked ? '#fde68a' : undefined,
              backgroundColor: isLocked ? '#fffbeb' : undefined,
              color: isLocked ? '#92400e' : undefined
            }}
          >
            {isLocked ? (
              <>
                <Lock style={{ width: 14, height: 14, color: 'var(--accent-amber)' }} />
                <span>LOCKED</span>
              </>
            ) : (
              <>
                <Unlock style={{ width: 14, height: 14 }} />
                <span>UNLOCKED</span>
              </>
            )}
          </button>

        </div>

        {/* Mobile & Tablet Toggle Controls (< 900px) */}
        <div className="mobile-toggle-wrapper">
          <button
            onClick={onToggleLock}
            className={`btn ${isLocked ? 'btn-outline' : 'btn-emerald'}`}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              minHeight: 38,
              borderColor: isLocked ? '#fde68a' : undefined,
              backgroundColor: isLocked ? '#fffbeb' : undefined,
              color: isLocked ? '#92400e' : undefined
            }}
          >
            {isLocked ? <Lock style={{ width: 14, height: 14, color: 'var(--accent-amber)' }} /> : <Unlock style={{ width: 14, height: 14 }} />}
            <span>{isLocked ? 'LOCKED' : 'UNLOCKED'}</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-hamburger-btn"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X style={{ width: 22, height: 22 }} /> : <Menu style={{ width: 22, height: 22 }} />}
          </button>
        </div>

      </div>

      {/* Mobile Glassmorphic Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-drawer">

          {/* Navigation Section */}
          <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            PAGE NAVIGATION
          </div>

          <div className="mobile-tabs-container">
            <button
              type="button"
              onClick={() => handleTabClick('inspection')}
              className={`mobile-tab-item ${activeTab === 'inspection' ? 'mobile-tab-active' : ''}`}
            >
              <Camera style={{ width: 18, height: 18, color: activeTab === 'inspection' ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
              <span style={{ flex: 1, textAlign: 'left' }}>Photo & Oversize Inspection</span>
              <ChevronRight style={{ width: 16, height: 16, opacity: 0.5 }} />
            </button>

            <button
              type="button"
              onClick={() => handleTabClick('rates')}
              className={`mobile-tab-item ${activeTab === 'rates' ? 'mobile-tab-active' : ''}`}
            >
              <Layers style={{ width: 18, height: 18, color: activeTab === 'rates' ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
              <span style={{ flex: 1, textAlign: 'left' }}>Garment Rate Manager</span>
              {isLocked ? <Lock style={{ width: 14, height: 14, color: 'var(--accent-amber)' }} /> : <ChevronRight style={{ width: 16, height: 16, opacity: 0.5 }} />}
            </button>
          </div>

          {/* Tools & Config Section */}
          <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 4 }}>
            SYSTEM TOOLS & CONFIG
          </div>

          <div className="mobile-actions-grid">
            <button
              onClick={() => {
                onOpenApiSettings();
                setMobileMenuOpen(false);
              }}
              className="btn btn-outline mobile-action-btn"
            >
              <Database style={{ width: 16, height: 16, color: 'var(--accent-primary)' }} />
              <span>Sheets API</span>
            </button>

            <button
              onClick={() => {
                onTriggerSplash();
                setMobileMenuOpen(false);
              }}
              className="btn btn-outline mobile-action-btn"
            >
              <RefreshCw style={{ width: 16, height: 16, color: 'var(--accent-cyan)' }} />
              <span>Splash Intro</span>
            </button>

            <button
              onClick={() => {
                onOpenAudit();
                setMobileMenuOpen(false);
              }}
              className="btn btn-outline mobile-action-btn"
            >
              <FileText style={{ width: 16, height: 16, color: 'var(--accent-purple)' }} />
              <span>Audit Logs</span>
            </button>
          </div>

          {/* Footer Status */}
          <div className="mobile-system-footer font-mono">
            <span>TIME: <strong>{timeString}</strong></span>
            <span>SYSTEM: <strong style={{ color: 'var(--accent-emerald)' }}>ONLINE</strong></span>
          </div>

        </div>
      )}
    </header>
  );
}
