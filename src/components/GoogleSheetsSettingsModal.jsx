import React, { useState, useEffect } from 'react';
import { X, Key, Database, CheckCircle2, AlertCircle, RefreshCw, Globe, Send } from 'lucide-react';
import { DEFAULT_SHEET_ID, fetchJobOrderData } from '../services/googleSheets';
import { BACKEND_URL } from '../config';

export default function GoogleSheetsSettingsModal({ isOpen, onClose, apiKey, setApiKey, sheetId, setSheetId, addAuditLog }) {
  const [testStatus, setTestStatus] = useState(null); // { type: 'success'|'error', msg: string }
  const [isTesting, setIsTesting] = useState(false);

  const [appsScriptUrl, setAppsScriptUrl] = useState(() => {
    return localStorage.getItem('garment_vault_apps_script_url') || '';
  });

  const [appsScriptStatus, setAppsScriptStatus] = useState(null);

  if (!isOpen) return null;

  const handleSaveAppsScriptUrl = async (urlToSave) => {
    const cleanUrl = urlToSave !== undefined ? urlToSave : appsScriptUrl;
    localStorage.setItem('garment_vault_apps_script_url', cleanUrl);

    if (cleanUrl && cleanUrl.startsWith('http')) {
      try {
        await fetch(`${BACKEND_URL}/api/set-apps-script`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webAppUrl: cleanUrl })
        });
        setAppsScriptStatus({ type: 'success', msg: 'Apps Script Web App URL connected to backend!' });
      } catch (err) {
        setAppsScriptStatus({ type: 'warning', msg: 'Saved in browser! (Start Express server to link backend)' });
      }
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestStatus({ type: 'error', msg: 'Please enter your Google API Key before testing.' });
      return;
    }

    setIsTesting(true);
    setTestStatus(null);

    try {
      const res = await fetchJobOrderData(apiKey, sheetId || DEFAULT_SHEET_ID);
      setTestStatus({
        type: 'success',
        msg: `Connection Successful! Found ${res.items.length} records in JobOrder sheet.`
      });
      addAuditLog('Google Sheets Connection Verified Successfully');
    } catch (err) {
      setTestStatus({
        type: 'error',
        msg: err.message || 'Failed to fetch Google Sheets data.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 520 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
              <Database style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Google Sheets & Drive Integration Settings</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Configure JobOrder Sheet ID & Google Apps Script Web App</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-outline" style={{ padding: 6, borderRadius: 8 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* Apps Script Web App URL Input */}
          <div className="form-group" style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #cbd5e1' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0f172a' }}>
              <Globe style={{ width: 15, height: 15, color: '#10b981' }} />
              Google Apps Script Web App URL (For Drive Photos)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={appsScriptUrl}
                onChange={(e) => {
                  setAppsScriptUrl(e.target.value);
                  handleSaveAppsScriptUrl(e.target.value);
                }}
                className="input-control font-mono"
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                style={{ fontSize: '0.82rem' }}
              />
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: 4 }}>
              Paste your deployed Web App URL here to upload photos directly to folder <strong>BARCODE ARTICLE IMAGES</strong>!
            </span>
            {appsScriptStatus && (
              <span style={{ fontSize: '0.72rem', color: appsScriptStatus.type === 'success' ? '#047857' : '#b45309', fontWeight: 'bold', display: 'block', marginTop: 4 }}>
                ✓ {appsScriptStatus.msg}
              </span>
            )}
          </div>

          {/* Sheet ID */}
          <div className="form-group">
            <label className="form-label">Google Sheet ID *</label>
            <input
              type="text"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              className="input-control font-mono"
              placeholder="e.g. 1e2Ts2gOGIYSXwO6vi_Zij8y5azpW9iSEnWEl6TZki4s"
            />
          </div>

          {/* API Key Input */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Key style={{ width: 14, height: 14, color: 'var(--accent-emerald)' }} />
              Google Cloud API Key (Optional)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="input-control font-mono"
              placeholder="Paste your AIzaSy... API Key here"
            />
          </div>

          {/* Test Feedback Alert */}
          {testStatus && (
            <div style={{
              padding: 12,
              borderRadius: 10,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: testStatus.type === 'success' ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${testStatus.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
              color: testStatus.type === 'success' ? '#047857' : '#dc2626'
            }}>
              {testStatus.type === 'success' ? <CheckCircle2 style={{ width: 18, height: 18 }} /> : <AlertCircle style={{ width: 18, height: 18 }} />}
              <span>{testStatus.msg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="btn btn-outline"
              style={{ fontSize: '0.85rem' }}
            >
              <RefreshCw style={{ width: 15, height: 15, color: 'var(--accent-primary)' }} />
              {isTesting ? 'Testing API...' : 'Test Connection'}
            </button>

            <button
              type="button"
              onClick={() => {
                handleSaveAppsScriptUrl();
                onClose();
              }}
              className="btn btn-emerald"
              style={{ fontSize: '0.85rem' }}
            >
              SAVE CONFIG
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
