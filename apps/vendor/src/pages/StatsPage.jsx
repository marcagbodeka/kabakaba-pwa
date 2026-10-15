import { useEffect, useState } from 'react';
import VendorHeader from '../components/VendorHeader';
import { vendorApi } from '../lib/api';
import { formatTickets } from '../lib/format';

export default function StatsPage({
  vendor,
  onCapacityTap,
  onNotificationTap,
  hasUnread,
  showSnack,
}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await vendorApi.sales({ groupBy: 'day' });
        if (alive) setSummary(data.summary || null);
      } catch (e) {
        if (alive) showSnack(e.message || 'Stats indisponibles');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [showSnack]);

  return (
    <div className="dashboard-body">
      <VendorHeader
        vendor={vendor}
        showNotification
        hasUnread={hasUnread}
        onNotificationTap={onNotificationTap}
        onCapacityTap={onCapacityTap}
      />
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="stats-grid">
          <div className="metric">
            <label>Commandes créditées</label>
            <strong>{summary?.creditedOrders ?? 0}</strong>
          </div>
          <div className="metric">
            <label>Encaissé</label>
            <strong>{formatTickets(summary?.collectedTickets ?? 0)}</strong>
          </div>
          <div className="metric">
            <label>Annulations</label>
            <strong>{summary?.cancelledOrders ?? 0}</strong>
          </div>
          <div className="metric">
            <label>Remboursé</label>
            <strong>{formatTickets(summary?.refundedTickets ?? 0)}</strong>
          </div>
        </div>
      )}
      <div className="page-pad">
        <p className="muted">Période : 30 derniers jours (comme l’app vendeur).</p>
      </div>
    </div>
  );
}
