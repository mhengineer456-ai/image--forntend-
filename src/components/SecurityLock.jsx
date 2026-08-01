import React, { useState } from 'react';
import { Lock, Unlock, ShieldAlert, KeyRound, X, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function SecurityLock({ isLocked, onUnlock, onLock, masterPin, onUpdatePin, auditLogs }) {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showChangePin, setShowChangePin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleKeyPress = (digit) => {
    if (pinInput.length < 6) {
      setPinInput(prev => prev + digit);
      setErrorMsg('');
    }
  };

  const handleClear = () => {
    setPinInput('');
    setErrorMsg('');
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleUnlockSubmit = (e) => {
    if (e) e.preventDefault();
    if (pinInput === masterPin) {
      onUnlock();
      setPinInput('');
      setErrorMsg('');
    } else {
      setErrorMsg('Invalid Security PIN. Access Denied.');
      setPinInput('');
    }
  };

  const handleChangePinSubmit = (e) => {
    e.preventDefault();
    if (newPin.length !== 6) {
      setErrorMsg('New Master PIN must be exactly 6 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('PIN confirmation does not match.');
      return;
    }
    onUpdatePin(newPin);
    setShowChangePin(false);
    setNewPin('');
    setConfirmPin('');
    setErrorMsg('Security Master PIN Updated to 6 Digits Successfully!');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 440, padding: 24, borderRadius: 24 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, marginBottom: 20, borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: isLocked ? '#fffbeb' : '#ecfdf5',
              border: `1px solid ${isLocked ? '#fde68a' : '#a7f3d0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isLocked ? '#d97706' : '#10b981'
            }}>
              {isLocked ? <Lock style={{ width: 22, height: 22 }} /> : <Unlock style={{ width: 22, height: 22 }} />}
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>
                {isLocked ? 'Security Guard Lock' : 'Vault Unlocked'}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                6-Digit Master PIN Authorization
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => isLocked ? null : onLock()}
            className="btn btn-outline"
            style={{ padding: 6, borderRadius: 10 }}
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {isLocked ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 20,
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#b45309',
                fontSize: '0.78rem',
                fontWeight: 'bold',
                fontFamily: 'var(--font-mono)',
                marginBottom: 8
              }}>
                <ShieldAlert style={{ width: 15, height: 15 }} />
                ENTER 6-DIGIT MASTER PIN TO VIEW & EDIT RATES
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Lot rates are protected from unapproved access until unlocked.
              </p>
            </div>

            {/* 6-DIGIT PIN DISPLAY BOXES */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              {[...Array(6)].map((_, i) => (
                <div 
                  key={i}
                  style={{
                    width: 42,
                    height: 50,
                    borderRadius: 12,
                    border: `2px solid ${pinInput[i] ? '#2563eb' : '#cbd5e1'}`,
                    background: pinInput[i] ? '#eff6ff' : '#ffffff',
                    boxShadow: pinInput[i] ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    fontWeight: '800',
                    fontFamily: 'var(--font-mono)',
                    color: '#2563eb',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {pinInput[i] ? '•' : ''}
                </div>
              ))}
            </div>

            {errorMsg && (
              <div style={{ padding: 10, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.82rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold' }}>
                <AlertTriangle style={{ width: 16, height: 16 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* KEYPAD GRID */}
            <div className="keypad-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(num.toString())}
                  className="keypad-btn"
                >
                  {num}
                </button>
              ))}
              <button type="button" onClick={handleClear} className="keypad-btn" style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                CLEAR
              </button>
              <button type="button" onClick={() => handleKeyPress('0')} className="keypad-btn">
                0
              </button>
              <button type="button" onClick={handleBackspace} className="keypad-btn" style={{ fontSize: '1.1rem', color: '#64748b' }}>
                ⌫
              </button>
            </div>

            <button
              onClick={handleUnlockSubmit}
              disabled={pinInput.length === 0}
              className="btn btn-emerald"
              style={{ width: '100%', padding: '12px 18px', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 'bold' }}
            >
              <Unlock style={{ width: 18, height: 18 }} /> UNLOCK SYSTEM VAULT NOW
            </button>

            <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Default Master PIN: <strong style={{ color: '#2563eb' }}>{masterPin}</strong>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ padding: 16, borderRadius: 14, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <ShieldCheck style={{ width: 22, height: 22, flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.85rem' }}>
                <strong style={{ display: 'block', marginBottom: 4, fontSize: '0.95rem' }}>System Vault Unlocked</strong>
                You have full authorization to view lot rates, edit prices, set oversized rates, and export PDF showcase catalogues.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <button onClick={onLock} className="btn btn-outline" style={{ justifyContent: 'center', borderColor: '#fde68a', color: '#b45309', padding: '12px 18px' }}>
                <Lock style={{ width: 18, height: 18 }} /> LOCK SYSTEM NOW
              </button>

              <button onClick={() => setShowChangePin(!showChangePin)} className="btn btn-outline" style={{ justifyContent: 'center', padding: '12px 18px' }}>
                <KeyRound style={{ width: 18, height: 18, color: 'var(--accent-primary)' }} /> {showChangePin ? 'CANCEL PIN CHANGE' : 'CHANGE 6-DIGIT MASTER PIN'}
              </button>
            </div>

            {showChangePin && (
              <form onSubmit={handleChangePinSubmit} style={{ padding: 16, borderRadius: 14, background: '#f8fafc', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>SET NEW 6-DIGIT MASTER PIN</div>
                <div className="form-group">
                  <label className="form-label">New 6-Digit PIN *</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="input-control font-mono font-bold"
                    placeholder="e.g. 123456"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New 6-Digit PIN *</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    className="input-control font-mono font-bold"
                    placeholder="Re-enter 6-digit PIN"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '0.88rem', padding: '10px 18px' }}>
                  SAVE 6-DIGIT MASTER PIN
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
