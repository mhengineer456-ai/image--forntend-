import React from 'react';
import { X, FileText, Trash2, Clock } from 'lucide-react';

export default function AuditLogModal({ isOpen, onClose, logs, onClearLogs }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, marginBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f5f3ff', border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'var(--accent-purple)', justifyContent: 'center' }}>
              <FileText style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Security Audit Trail Log</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lot & Garment Rate modification history</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-outline" style={{ padding: 6, borderRadius: 8 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Logs */}
        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 12, background: '#f8fafc', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              <Clock style={{ width: 28, height: 28, margin: '0 auto 8px auto', opacity: 0.4 }} />
              No security audit logs recorded yet.
            </div>
          ) : (
            logs.map((log, index) => (
              <div 
                key={index} 
                style={{ padding: 10, borderRadius: 8, background: '#ffffff', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }}></span>
                  <span>{log.action}</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>{log.time}</span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Events Logged: <strong style={{ color: 'var(--accent-purple)' }}>{logs.length}</strong>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClearLogs} disabled={logs.length === 0} className="btn btn-danger" style={{ fontSize: '0.8rem' }}>
              <Trash2 style={{ width: 14, height: 14 }} /> Clear Logs
            </button>
            <button onClick={onClose} className="btn btn-outline" style={{ fontSize: '0.8rem' }}>
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
