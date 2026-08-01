import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Cpu, Server, Key, ArrowRight, Activity } from 'lucide-react';

export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const securitySteps = [
    { text: "Initializing Quantum Cryptographic Shield...", icon: Cpu },
    { text: "Loading Garment Lot & Rate Database...", icon: Server },
    { text: "Auditing Rate Approval Signatures...", icon: Key },
    { text: "Security System Fully Operational. Access Granted.", icon: ShieldCheck }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        const next = prev + 2;
        if (next > 25 && currentStepIndex === 0) setCurrentStepIndex(1);
        if (next > 55 && currentStepIndex === 1) setCurrentStepIndex(2);
        if (next > 85 && currentStepIndex === 2) setCurrentStepIndex(3);
        return next;
      });
    }, 40);

    return () => clearInterval(timer);
  }, [currentStepIndex]);

  const CurrentIcon = securitySteps[currentStepIndex].icon;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }}>
      
      <div style={{
        maxWidth: 520,
        width: '100%',
        background: '#ffffff',
        borderRadius: 24,
        padding: '36px 28px',
        boxShadow: '0 20px 50px rgba(15, 23, 42, 0.1)',
        border: '1px solid #cbd5e1',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        
        {/* Graphic Box */}
        <div style={{
          width: 100,
          height: 100,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          border: '1px solid #bfdbfe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.15)',
          color: progress < 100 ? '#2563eb' : '#10b981'
        }}>
          {progress < 100 ? (
            <Shield style={{ width: 48, height: 48 }} />
          ) : (
            <ShieldCheck style={{ width: 48, height: 48 }} />
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 20,
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#2563eb',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            fontFamily: 'var(--font-mono)',
            marginBottom: 8
          }}>
            <Activity style={{ width: 14, height: 14 }} />
            GARMENT RATE VAULT v2.5
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            Rate Security System
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: 4 }}>
            Lot Number & Garment Article Protection Engine
          </p>
        </div>

        {/* Progress Box */}
        <div style={{
          width: '100%',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: 16,
          marginBottom: 24,
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', marginBottom: 8, color: '#475569' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb', fontWeight: 600 }}>
              <CurrentIcon style={{ width: 14, height: 14 }} />
              {securitySteps[currentStepIndex].text}
            </span>
            <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{progress}%</span>
          </div>

          <div style={{ width: '100%', height: 10, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #2563eb 0%, #10b981 100%)',
              borderRadius: 10,
              transition: 'width 0.3s ease'
            }}></div>
          </div>
        </div>

        <button
          onClick={onComplete}
          disabled={progress < 100}
          className={`btn ${progress === 100 ? 'btn-emerald' : 'btn-outline'}`}
          style={{
            width: '100%',
            padding: 14,
            justifyContent: 'center',
            fontSize: '0.95rem',
            opacity: progress < 100 ? 0.6 : 1,
            cursor: progress < 100 ? 'not-allowed' : 'pointer'
          }}
        >
          {progress === 100 ? (
            <>
              ACCESS GARMENT RATE SOFTWARE <ArrowRight style={{ width: 18, height: 18 }} />
            </>
          ) : (
            `INITIALIZING SYSTEM (${progress}%)`
          )}
        </button>

      </div>
    </div>
  );
}
