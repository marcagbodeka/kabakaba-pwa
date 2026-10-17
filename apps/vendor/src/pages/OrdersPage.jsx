import { useCallback, useEffect, useRef, useState } from 'react';
import VendorHeader from '../components/VendorHeader';
import SectionTabs from '../components/SectionTabs';
import { IconCheck, IconClose, IconReceipt } from '../components/icons';
import { ORDER_BUCKETS, ordersApi } from '../lib/api';
import {
  ORDER_STATUS_LABEL,
  consumptionLabel,
  formatTickets,
  formatTime,
  orderDisplayCode,
} from '../lib/format';

const ORDER_SOUND_MUTE_KEY = 'kaba_vendor_order_sounds_muted';

function playNewOrderSound() {
  if (localStorage.getItem(ORDER_SOUND_MUTE_KEY) === '1') return;
  if (document.visibilityState !== 'visible') return;
  const audio = new Audio('/sounds/new-order.wav');
  audio.play().catch(() => {});
}

const TABS = [
  { key: 'incoming', label: 'Confirmées' },
  { key: 'preparing', label: 'Préparation' },
  { key: 'ready', label: 'Prêtes' },
  { key: 'history', label: 'Historique' },
];

const CANCEL_CHIPS = [
  'Rupture de stock',
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

function OrderTimeline({ currentStep }) {
  const steps = ['Confirmée', 'Préparation', 'Prête'];
  return (
    <div className="order-timeline">
      {steps.map((label, i) => {
        const step = i + 1;
        const done = step < currentStep;
        const current = step === currentStep;
        return (
          <div
            key={label}
            className={`order-timeline-step${done ? ' done' : ''}${current ? ' current' : ''}`}
          >
            <div className="order-timeline-rail">
              <span className="order-timeline-dot">{done ? '✓' : step}</span>
              {i < steps.length - 1 ? <span className="order-timeline-line" /> : null}
            </div>
            <span className="order-timeline-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function CancelSheet({ onClose, onConfirm, busy }) {
  const [selected, setSelected] = useState(null);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Pourquoi annuler cette commande ?</h2>
        <p className="sub">
          Un motif est obligatoire. Les tickets seront remboursés à l&apos;étudiant et le stock
          restitué.
        </p>
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
  const code = orderDisplayCode(order);

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
          : order.status === 'CANCELLED'
            ? 'cancelled'
            : 'done';

  const meta =
    order.status === 'READY'
      ? `N° ${code} · en attente de retrait`
      : `${studentName} · ${formatTime(order.createdAt)}`;

  return (
    <>
      <article className={`order-card ${cardClass}`}>
        <div className="order-top">
          <div className="icon-box">
            <IconReceipt />
          </div>
          <div className="order-top-text">
            <div className="order-num">Commande {code}</div>
            <div className="order-meta">{meta}</div>
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
            <OrderTimeline currentStep={1} />
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
            <OrderTimeline currentStep={2} />
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
          <>
            <div className="order-number-banner">
              <span>Numéro de commande</span>
              <strong>{code}</strong>
            </div>
            {order.unclaimedAt ? (
              <div className="unclaimed-banner">
                Non récupérée depuis {formatTime(order.unclaimedAt)} — vérifie au comptoir.
              </div>
            ) : null}
            <div className="ready-banner">
              <div className="ready-banner-title">
                <IconCheck /> Commande prête · montants crédités
              </div>
              <p>
                L&apos;étudiant a été notifié. Remets la commande au comptoir puis marque-la
                récupérée.
              </p>
            </div>
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
          </>
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
  const knownConfirmedRef = useRef(null);

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

      const incoming = results.find(([key]) => key === 'incoming')?.[1]?.data || [];
      const confirmedIds = incoming
        .filter((o) => o.status === 'CONFIRMED')
        .map((o) => o.id);
      if (knownConfirmedRef.current === null) {
        knownConfirmedRef.current = new Set(confirmedIds);
      } else {
        for (const id of confirmedIds) {
          if (!knownConfirmedRef.current.has(id)) {
            playNewOrderSound();
            knownConfirmedRef.current.add(id);
          }
        }
      }
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
    incoming: 'Les commandes des étudiants apparaîtront ici dès qu’ils passeront commande.',
    preparing: 'Aucune commande en cours de préparation.',
    ready: 'Aucune commande prête à remettre pour le moment.',
    history: 'L’historique de tes commandes apparaîtra ici.',
  };

  const tabs = TABS.map((t) => ({
    ...t,
    badgeCount: t.key === 'history' ? null : counts[t.key] || 0,
  }));

  return (
    <div className="dashboard-body">
      <VendorHeader
        vendor={vendor}
        showNotification
        hasUnread={hasUnread}
        onNotificationTap={onNotificationTap}
        onCapacityTap={onCapacityTap}
      />

      <SectionTabs tabs={tabs} selectedKey={tab} onSelect={setTab} />

      <div className="orders-list">
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-card">
            <div className="empty-nest">
              <div className="empty-nest-inner">
                <IconReceipt size={28} />
              </div>
            </div>
            <h3>
              {tab === 'history' ? 'Pas encore d’historique' : 'Aucune commande pour l’instant'}
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
