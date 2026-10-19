import { useCallback, useEffect, useRef, useState } from 'react';
import VendorHeader from '../components/VendorHeader';
import SectionTabs from '../components/SectionTabs';
import { IconCheck, IconClose, IconReceipt } from '../components/icons';
import { ORDER_BUCKETS, ordersApi } from '../lib/api';
import { readView, writeView } from '../lib/instantView';
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

const LIVE_STATUSES = ['CONFIRMED', 'IN_PREPARATION', 'READY'];
const POLL_MS = 45_000;

function bucketKeyForStatus(status) {
  if (status === 'CONFIRMED') return 'incoming';
  if (status === 'IN_PREPARATION') return 'preparing';
  if (status === 'READY') return 'ready';
  return 'history';
}

export default function OrdersPage({
  vendor,
  showSnack,
  onCapacityTap,
  onNotificationTap,
  hasUnread,
}) {
  const [tab, setTab] = useState('incoming');
  const cachedLive = readView('orders-live');
  const cachedHistory = readView('orders-history');
  const [ordersByBucket, setOrdersByBucket] = useState({
    incoming: cachedLive?.incoming || [],
    preparing: cachedLive?.preparing || [],
    ready: cachedLive?.ready || [],
    history: Array.isArray(cachedHistory) ? cachedHistory : [],
  });
  const [counts, setCounts] = useState(() => cachedLive?.counts || {});
  const [loading, setLoading] = useState(!cachedLive);
  const knownConfirmedRef = useRef(
    cachedLive ? new Set((cachedLive.incoming || []).map((o) => o.id)) : null,
  );
  const backoffUntilRef = useRef(0);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const showSnackRef = useRef(showSnack);
  showSnackRef.current = showSnack;

  const applyLiveOrders = useCallback((list) => {
    const next = { incoming: [], preparing: [], ready: [] };
    for (const o of list) {
      const key = bucketKeyForStatus(o.status);
      if (key !== 'history') next[key].push(o);
    }
    setOrdersByBucket((prev) => ({ ...prev, ...next }));
    const liveCounts = {
      incoming: next.incoming.length,
      preparing: next.preparing.length,
      ready: next.ready.length,
    };
    setCounts((prev) => ({
      ...prev,
      ...liveCounts,
    }));
    writeView('orders-live', { ...next, counts: liveCounts });

    const confirmedIds = next.incoming.map((o) => o.id);
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
  }, []);

  const loadLive = useCallback(
    async ({ silent = false } = {}) => {
      if (Date.now() < backoffUntilRef.current) return;
      if (!silent && !readView('orders-live')) setLoading(true);
      try {
        const res = await ordersApi.list({ statuses: LIVE_STATUSES, limit: 80 });
        applyLiveOrders(res.data || []);
      } catch (e) {
        if (e?.statusCode === 429) {
          backoffUntilRef.current = Date.now() + 60_000;
          if (!silent) showSnackRef.current?.('Trop de requêtes — pause 1 min');
        } else if (e?.statusCode === 401) {
          showSnackRef.current?.(e.message || 'Session expirée — reconnecte-toi');
        } else if (!silent) {
          showSnackRef.current?.(e.message || 'Impossible de charger les commandes');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [applyLiveOrders],
  );

  const loadHistory = useCallback(async () => {
    if (Date.now() < backoffUntilRef.current) return;
    try {
      const res = await ordersApi.list({
        statuses: ORDER_BUCKETS.history.statuses,
        limit: 40,
      });
      const data = res.data || [];
      writeView('orders-history', data);
      setOrdersByBucket((prev) => ({ ...prev, history: data }));
      setCounts((prev) => ({
        ...prev,
        history: res.meta?.total ?? data.length,
      }));
    } catch (e) {
      if (e?.statusCode === 429) {
        backoffUntilRef.current = Date.now() + 60_000;
      } else {
        showSnackRef.current?.(e.message || 'Historique indisponible');
      }
    }
  }, []);

  const loadLiveRef = useRef(loadLive);
  loadLiveRef.current = loadLive;
  const loadHistoryRef = useRef(loadHistory);
  loadHistoryRef.current = loadHistory;

  const refresh = useCallback(async () => {
    await loadLiveRef.current({ silent: false });
    if (tabRef.current === 'history') await loadHistoryRef.current();
  }, []);

  // Mount once — jamais re-déclencher sur identité de callback.
  useEffect(() => {
    loadLiveRef.current({ silent: Boolean(readView('orders-live')) });
  }, []);

  useEffect(() => {
    if (tab === 'history') loadHistoryRef.current();
  }, [tab]);

  useEffect(() => {
    const onPush = (ev) => {
      const kind = String(ev?.detail?.kind || '');
      if (
        kind === 'NEW_ORDER' ||
        kind === 'ORDER_RING' ||
        kind === 'order_ring' ||
        kind.startsWith('ORDER_')
      ) {
        loadLiveRef.current({ silent: true });
      }
    };
    window.addEventListener('kabakaba:push', onPush);
    return () => window.removeEventListener('kabakaba:push', onPush);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      loadLiveRef.current({ silent: true });
      if (tabRef.current === 'history') loadHistoryRef.current();
    };
    const t = setInterval(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const emptyCopy = {
    incoming: 'Dès qu’un étudiant commande, elle apparaît ici en direct.',
    preparing: 'Passe une commande confirmée en préparation pour la suivre ici.',
    ready: 'Les commandes prêtes à remettre s’affichent ici.',
    history: 'Les commandes récupérées ou annulées se retrouvent ici.',
  };

  const emptyTitle = {
    incoming: 'En attente de commandes',
    preparing: 'Rien en préparation',
    ready: 'Rien à remettre',
    history: 'Historique vide',
  };

  const orders = ordersByBucket[tab] || [];
  const liveTotal =
    (counts.incoming || 0) + (counts.preparing || 0) + (counts.ready || 0);

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
        eyebrow="Commandes live"
        liveCount={liveTotal}
      />

      <div className="sheet-body sheet-body--orders">
        <SectionTabs tabs={tabs} selectedKey={tab} onSelect={setTab} />

        <div className="orders-list">
          {loading ? (
            <div className="skeleton-stack" aria-busy="true" aria-label="Chargement">
              <div className="skeleton-card" />
              <div className="skeleton-card" />
              <div className="skeleton-card" />
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-orb" aria-hidden>
                <div className="empty-orb-ring" />
                <div className="empty-orb-core">
                  <IconReceipt size={30} />
                </div>
              </div>
              <h3>{emptyTitle[tab]}</h3>
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
    </div>
  );
}
