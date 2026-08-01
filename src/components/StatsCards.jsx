import React from 'react';
import { Layers, Tag, ShieldCheck, IndianRupee } from 'lucide-react';

export default function StatsCards({ lots, isLocked }) {
  const totalLots = lots.length;
  
  const allArticles = lots.flatMap(l => l.articles || []);
  const totalArticles = allArticles.length;

  const avgRatePc = totalArticles > 0
    ? Math.round(allArticles.reduce((sum, a) => sum + (a.totalRatePerPc || 0), 0) / totalArticles)
    : 0;

  const highestRateArticle = allArticles.reduce((max, a) => {
    return (a.totalRatePerPc || 0) > (max.totalRatePerPc || 0) ? a : max;
  }, { totalRatePerPc: 0, articleCode: 'N/A' });

  return (
    <div className="stats-grid no-print">
      
      {/* Card 1 */}
      <div className="stat-card">
        <div>
          <div className="stat-title">GARMENT LOTS</div>
          <div className="stat-value">{totalLots}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Active Batch Lots</div>
        </div>
        <div className="stat-icon stat-icon-blue">
          <Layers style={{ width: 24, height: 24 }} />
        </div>
      </div>

      {/* Card 2 */}
      <div className="stat-card">
        <div>
          <div className="stat-title">TOTAL ARTICLES</div>
          <div className="stat-value">{totalArticles}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Garment Rates</div>
        </div>
        <div className="stat-icon stat-icon-purple">
          <Tag style={{ width: 24, height: 24 }} />
        </div>
      </div>

      {/* Card 3 */}
      <div className="stat-card">
        <div>
          <div className="stat-title">AVG RATE / PC</div>
          <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>₹{avgRatePc}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Highest: <strong style={{ color: 'var(--accent-emerald)' }}>₹{highestRateArticle.totalRatePerPc}</strong> ({highestRateArticle.articleCode})
          </div>
        </div>
        <div className="stat-icon stat-icon-emerald">
          <IndianRupee style={{ width: 24, height: 24 }} />
        </div>
      </div>

      {/* Card 4 */}
      <div className="stat-card">
        <div>
          <div className="stat-title">SECURITY GUARD</div>
          <div className="stat-value" style={{ fontSize: '1.25rem', color: isLocked ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
            {isLocked ? 'READ-ONLY' : 'AUTHORIZED'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Encrypted Storage</div>
        </div>
        <div className={`stat-icon ${isLocked ? 'stat-icon-amber' : 'stat-icon-emerald'}`}>
          <ShieldCheck style={{ width: 24, height: 24 }} />
        </div>
      </div>

    </div>
  );
}
