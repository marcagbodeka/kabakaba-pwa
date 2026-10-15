import { useCallback, useEffect, useState } from 'react';
import VendorHeader from '../components/VendorHeader';
import { IconCheck, IconClose, IconReceipt } from '../components/icons';
import { ORDER_BUCKETS, ordersApi } from '../lib/api';
import {
  ORDER_STATUS_LABEL,
  consumptionLabel,
  formatTickets,
  formatTime,
} from '../lib/format';

const TABS = [
  { key: 'incoming', label: 'Nouvelles' },
  { key: 'preparing', label: 'Préparation' },
  { key: 'ready', label: 'Prêtes' },
  { key: 'history', label: 'Historique' },
];

const CANCEL_CHIPS = [
  'Rupture de stock',
  'Cantine surchargée',
  'Ingrédient manquant',
  'Erreur de préparation',
  'Autre',
];

function StatusBadge({ status }) {
  const cls = {
    CONFIRMED: 'confirmed',
    IN_PREPARATION: 'prep',
    READY: 'ready',
    RECEIVED: 'received',
    CANCELLED: 'cancelled',
  }[status];
  return (
    <span className={`status-badge ${cls}`}>{ORDER_STATUS_LABEL[status] || status}</span>
  );
}

function CancelSheet({ onClose, onConfirm, busy }) {
  const [selected, setSelected] = useState(null);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Pourquoi annuler cette commande ?</h2>
        <p className="sub">Les tickets seront immédiatement recrédités à l&apos;étudiant.</p>
        <div className="chips">
          {CANCEL_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip${selected === c ? ' active' : ''}`}
              onClick={() => setSelected(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          <button
            type="button"
            className="btn-action fill accent full"
            disabled={!selected || busy}
            onClick={() => onConfirm(selected)}
          >
            Confirmer l&apos;annulation
          </button>
          <button type="button" className="btn-action outline full" onClick={onClose}>
            Retour
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, onChanged, showSnack }) {
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const studentName = order.student
    ? `${order.student.firstName || ''} ${order.student.lastName || ''}`.trim()
    : 'Étudiant';

  const run = async (fn, failMsg) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (e) {
      showSnack(e.message || failMsg);
    } finally {
      setBusy(false);
    }
  };

  const cardClass =
    order.status === 'CONFIRMED'
      ? 'confirmed'
      : order.status === 'IN_PREPARATION'
        ? 'prep'
        : order.status === 'READY'
          ? 'ready'
          : 'done';

  return (
    <>
      <article className={`order-card ${cardClass}`}>
        <div className="order-top">
          <div className="icon-box">
            <IconReceipt />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="order-num">Commande #{order.orderNumber}</div>
            <div className="order-meta">
              {studentName} · {formatTime(order.createdAt)}
            </div>
          </div>
          {order.status === 'CONFIRMED' ? (
            <div className="order-amount">{formatTickets(order.totalTickets)}</div>
          ) : (
            <StatusBadge status={order.status} />
          )}
        </div>

        <div className="order-items">
          {(order.items || []).map((item, i) => (
            <span key={item.id || i}>
              {i > 0 ? ' · ' : ''}
              <strong>{item.quantity}×</strong> {item.name}
            </span>
          ))}
          {(order.items || []).length ? ' · ' : ''}
          <strong>{consumptionLabel(order)}</strong>
        </div>

        {order.status === 'CONFIRMED' ? (
          <>
            <button
              type="button"
              className="btn-action fill primary full"
              disabled={busy}
              onClick={() =>
                run(
                  () => ordersApi.updateStatus(order.id, 'IN_PREPARATION'),
                  'Mise à jour impossible.',
                )
              }
            >
              Commencer la préparation
            </button>
            <div className="action-row">
              <button
                type="button"
                className="btn-action outline full"
                disabled={busy}
                onClick={() => setCancelOpen(true)}
              >
                <IconClose /> Annuler la commande
              </button>
            </div>
          </>
        ) : null}

        {order.status === 'IN_PREPARATION' ? (
          <>
            <button
              type="button"
              className="btn-action fill accent full"
              disabled={busy}
              onClick={() =>
                run(() => ordersApi.updateStatus(order.id, 'READY'), 'Mise à jour impossible.')
              }
            >
              <IconCheck /> Marquer comme prête
            </button>
            <div className="action-row">
              <button
                type="button"
                className="btn-action outline full"
                disabled={busy}
                onClick={() => setCancelOpen(true)}
              >
                <IconClose /> Annuler la commande
              </button>
            </div>
          </>
        ) : null}

        {order.status === 'READY' ? (
          <button
            type="button"
            className="btn-action fill green full"
            disabled={busy}
            onClick={() =>
              run(() => ordersApi.updateStatus(order.id, 'RECEIVED'), 'Mise à jour impossible.')
            }
          >
            <IconCheck /> Marquer comme récupérée
          </button>
        ) : null}

        {(order.status === 'RECEIVED' || order.status === 'CANCELLED') && (
          <div className="action-row" style={{ alignItems: 'center' }}>
            <StatusBadge status={order.status} />
            <div className="order-amount">{formatTickets(order.totalTickets)}</div>
          </div>
        )}
      </article>

      {cancelOpen ? (
        <CancelSheet
          busy={busy}
          onClose={() => setCancelOpen(false)}
          onConfirm={(reason) =>
            run(async () => {
              await ordersApi.cancel(order.id, reason);
              setCancelOpen(false);
            }, 'Annulation impossible. Réessaie.')
          }
        />
      ) : null}
    </>
  );
}

export default function OrdersPage({
  vendor,
  showSnack,
  onCapacityTap,
  onNotificationTap,
  hasUnread,
}) {
  const [tab, setTab] = useState('incoming');
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const loadBucket = useCallback(async (key) => {
    const { statuses } = ORDER_BUCKETS[key];
    const res = await ordersApi.list({ statuses, limit: 50 });
    return { data: res.data || [], total: res.meta?.total ?? (res.data || []).length };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        Object.keys(ORDER_BUCKETS).map(async (key) => {
          const r = await loadBucket(key);
          return [key, r];
        }),
      );
      const nextCounts = {};
      let current = [];
      for (const [key, r] of results) {
        nextCounts[key] = r.total;
        if (key === tab) current = r.data;
      }
      setCounts(nextCounts);
      setOrders(current);
    } catch (e) {
      showSnack(e.message || 'Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  }, [loadBucket, showSnack, tab]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

  const emptyCopy = {
    incoming:
      'Les commandes des étudiants apparaîtront ici dès qu’ils passeront commande.',
    preparing: 'Aucune commande en cours de préparation.',
    ready: 'Aucune commande prête à remettre pour le moment.',
    history: 'L’historique de tes commandes apparaîtra ici.',
  };

  return (
    <div className="dashboard-body">
      <VendorHeader
        vendor={vendor}
        showNotification
        hasUnread={hasUnread}
        onNotificationTap={onNotificationTap}
        onCapacityTap={onCapacityTap}
      />

      <div className="section-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`section-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key !== 'history' && counts[t.key] > 0 ? (
              <span className="tab-badge">{counts[t.key]}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="orders-list">
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-card">
            <IconReceipt size={36} />
            <h3>
              {tab === 'history'
                ? 'Pas encore d’historique'
                : 'Aucune commande pour l’instant'}
            </h3>
            <p>{emptyCopy[tab]}</p>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onChanged={refresh}
              showSnack={showSnack}
            />
          ))
        )}
      </div>

    </div>
  );
}
