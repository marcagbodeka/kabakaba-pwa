import { useEffect, useMemo, useState } from 'react';
import VendorHeader from '../components/VendorHeader';
import SectionTabs from '../components/SectionTabs';
import { ORDER_BUCKETS, ordersApi, vendorApi } from '../lib/api';
import { formatTickets } from '../lib/format';

const TABS = [
  { key: 'overview', label: "Vue d'ensemble" },
  { key: 'performance', label: 'Performance' },
  { key: 'top', label: 'Top articles' },
  { key: 'affluence', label: 'Affluence' },
];

async function loadAllOrders() {
  const results = await Promise.all(
    Object.keys(ORDER_BUCKETS).map(async (key) => {
      const { statuses } = ORDER_BUCKETS[key];
      const res = await ordersApi.list({ statuses, limit: 100 });
      return res.data || [];
    }),
  );
  const byId = new Map();
  for (const list of results) {
    for (const o of list) byId.set(o.id, o);
  }
  return [...byId.values()];
}

function MetricCard({ label, value }) {
  return (
    <div className="metric">
      <label>{label}</label>
      <strong>{value}</strong>
    </div>
  );
}

function PerfRow({ title, sub, percentage, warn }) {
  const pct = Math.max(0, Math.min(100, Number(percentage) || 0));
  return (
    <div className="perf-row">
      <div className="perf-row-text">
        <strong>{title}</strong>
        <span>{sub}</span>
      </div>
      <div className={`perf-ring${warn ? ' warn' : ''}`} style={{ '--pct': `${pct}%` }}>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

function RankRow({ rank, name, count, ratio }) {
  return (
    <div className="rank-row">
      <span className="rank-num">{rank}</span>
      <div className="rank-body">
        <div className="rank-top">
          <strong>{name}</strong>
          <span>{count}</span>
        </div>
        <div className="rank-bar">
          <span style={{ width: `${Math.max(8, ratio * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function StatsPage({
  vendor,
  onCapacityTap,
  onNotificationTap,
  hasUnread,
  showSnack,
}) {
  const [tab, setTab] = useState('overview');
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [allOrders, salesData] = await Promise.all([
          loadAllOrders(),
          vendorApi.sales({ groupBy: 'day' }).catch(() => null),
        ]);
        if (!alive) return;
        setOrders(allOrders);
        setSales(salesData);
      } catch (e) {
        if (alive) showSnack?.(e.message || 'Stats indisponibles');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [showSnack]);

  const analytics = useMemo(() => {
    const credited = orders.filter(
      (o) => o.status === 'READY' || o.status === 'RECEIVED',
    );
    const revenue = credited.reduce((s, o) => s + Number(o.totalTickets || 0), 0);
    const avg = credited.length ? Math.round(revenue / credited.length) : 0;
    const completionRate = orders.length
      ? Math.round((credited.length / orders.length) * 100)
      : 0;

    const accepted = orders.filter((o) =>
      ['CONFIRMED', 'IN_PREPARATION', 'READY', 'RECEIVED'].includes(o.status),
    ).length;
    const refused = orders.filter((o) => o.status === 'CANCELLED').length;
    const vendorCancel = orders.filter(
      (o) =>
        o.status === 'CANCELLED' &&
        String(o.cancelledBy || '').toUpperCase() === 'VENDOR',
    ).length;
    const total = orders.length || 1;

    const counts = {};
    for (const o of orders) {
      for (const it of o.items || []) {
        const name = it.name || 'Article';
        counts[name] = (counts[name] || 0) + Number(it.quantity || 0);
      }
    }
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const maxTop = top[0]?.[1] || 1;

    const byHour = {};
    for (const o of orders) {
      if (!o.createdAt) continue;
      const h = new Date(o.createdAt).getHours();
      byHour[h] = (byHour[h] || 0) + 1;
    }
    const hours = Array.from({ length: 11 }, (_, i) => i + 8);
    const values = hours.map((h) => byHour[h] || 0);
    const maxHour = values.reduce((a, b) => (a > b ? a : b), 0);
    const peakIndex = maxHour === 0 ? -1 : values.indexOf(maxHour);

    return {
      revenue,
      orderCount: orders.length,
      avg,
      completionRate,
      accepted,
      refused,
      vendorCancel,
      total,
      top,
      maxTop,
      hours,
      values,
      maxHour,
      peakIndex,
      salesSummary: sales?.summary || null,
    };
  }, [orders, sales]);

  return (
    <div className="dashboard-body">
      <VendorHeader
        vendor={vendor}
        showNotification
        hasUnread={hasUnread}
        onNotificationTap={onNotificationTap}
        onCapacityTap={onCapacityTap}
      />

      <SectionTabs
        tabs={TABS}
        selectedKey={tab}
        onSelect={setTab}
      />

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="stats-scroll">
          {tab === 'overview' ? (
            <>
              <div className="stats-grid">
                <MetricCard
                  label="Chiffre d'affaires"
                  value={formatTickets(analytics.revenue)}
                />
                <MetricCard label="Commandes" value={String(analytics.orderCount)} />
                <MetricCard
                  label="Panier moyen"
                  value={formatTickets(analytics.avg)}
                />
                <MetricCard
                  label="Taux de complétion"
                  value={`${analytics.completionRate}%`}
                />
              </div>
              {analytics.salesSummary ? (
                <div className="stats-sales-note">
                  API 30 j — créditées {analytics.salesSummary.creditedOrders} · encaissé{' '}
                  {formatTickets(analytics.salesSummary.collectedTickets)} · annul.{" "}
                  {analytics.salesSummary.cancelledOrders}
                </div>
              ) : null}
            </>
          ) : null}

          {tab === 'performance' ? (
            <div className="stats-card">
              <PerfRow
                title="Taux d'acceptation"
                sub={`${analytics.accepted} commandes acceptées sur ${analytics.orderCount} reçues`}
                percentage={Math.round((analytics.accepted / analytics.total) * 100)}
              />
              <PerfRow
                title="Taux de refus"
                sub={`${analytics.refused} commandes refusées`}
                percentage={Math.round((analytics.refused / analytics.total) * 100)}
                warn
              />
              <PerfRow
                title="Annulation après acceptation"
                sub={`${analytics.vendorCancel} commande annulée en cours de préparation`}
                percentage={Math.round((analytics.vendorCancel / analytics.total) * 100)}
                warn
              />
            </div>
          ) : null}

          {tab === 'top' ? (
            analytics.top.length === 0 ? (
              <div className="empty-card">
                <h3>Pas encore de ventes</h3>
                <p>Les articles les plus commandés apparaîtront ici.</p>
              </div>
            ) : (
              <div className="stats-card stats-card--pad">
                {analytics.top.map(([name, count], i) => (
                  <RankRow
                    key={name}
                    rank={i + 1}
                    name={name}
                    count={count}
                    ratio={count / analytics.maxTop}
                  />
                ))}
              </div>
            )
          ) : null}

          {tab === 'affluence' ? (
            <div className="stats-card stats-card--pad">
              <div className="affluence-head">
                <strong>Commandes par heure</strong>
                <span>De 8h à 18h (échantillon chargé)</span>
              </div>
              <div className="affluence-chart">
                {analytics.hours.map((h, i) => {
                  const v = analytics.values[i];
                  const height =
                    analytics.maxHour === 0
                      ? 8
                      : Math.max(8, Math.round((v / analytics.maxHour) * 120));
                  const peak = i === analytics.peakIndex;
                  return (
                    <div key={h} className="affluence-col">
                      <div
                        className={`affluence-bar${peak ? ' peak' : ''}`}
                        style={{ height }}
                        title={`${v} commande(s)`}
                      />
                      <span>{h}h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
