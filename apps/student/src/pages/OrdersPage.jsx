import { useCallback, useEffect, useRef, useState } from 'react';
import { ordersApi, reportsApi, reviewsApi, scheduledOrdersApi } from '../lib/api';
import {
  ORDER_STATUS_LABEL,
  formatTicketCount,
  formatTickets,
  formatTime,
} from '../lib/format';
import { IconBack } from '../components/icons';
import { readView, writeView } from '../lib/instantView';

const ORDER_TABS = [
  { key: 'scheduled', label: 'Programmées' },
  { key: 'confirmed', label: 'Confirmées', statuses: ['CONFIRMED'] },
  { key: 'active', label: 'En cours', statuses: ['IN_PREPARATION', 'READY'] },
  { key: 'history', label: 'Historique', statuses: ['RECEIVED', 'CANCELLED'] },
];

const REPORT_TYPES = [
  { value: 'WRONG_MEAL', label: 'Mauvais repas' },
  { value: 'MISSING_COMPONENT', label: 'Composant manquant' },
  { value: 'INCOMPLETE_ORDER', label: 'Commande incomplète' },
  { value: 'OTHER', label: 'Autre' },
];

const SCHEDULE_LABEL = {
  PENDING: 'Programmée',
  PLACED: 'Passée',
  FAILED: 'Échouée',
  CANCELLED: 'Annulée',
};

const REVIEW_KEY = 'kabakaba.student.reviews';

function readStoredReview(orderId) {
  try {
    const all = JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}');
    return all[orderId] || null;
  } catch {
    return null;
  }
}

function storeReview(orderId, review) {
  let all = {};
  try {
    all = JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}');
  } catch {
    all = {};
  }
  all[orderId] = {
    id: review.id,
    rating: review.rating,
    comment: review.comment || '',
  };
  localStorage.setItem(REVIEW_KEY, JSON.stringify(all));
}

function orderCode(order) {
  const code = String(order?.orderNumber || order?.activeOrderNumber || '').trim();
  if (/^[A-Z]-\d{2}$/i.test(code)) return code.toUpperCase();
  return '';
}

function dayOffset(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const n = new Date();
  const start = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const other = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((start - other) / 86400000);
}

function isRecent(value) {
  const offset = dayOffset(value);
  return offset === 0 || offset === 1;
}

const DONE_STATUSES = new Set(['RECEIVED', 'CANCELLED']);

function itemCount(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function planItemLabel(item) {
  if (item?.name) return item.name;
  if (item?.menuId) return 'Menu';
  return 'Plat';
}

function playOrderReadySound() {
  const audio = new Audio('/sounds/order-ready.wav');
  audio.play().catch(() => {});
}

export default function OrdersPage({
  embedded = true,
  focusOrderId,
  onBack,
  showSnack,
  onDetailOpenChange,
}) {
  const cachedOrders = readView('orders');
  const [orders, setOrders] = useState(() => cachedOrders?.orders || []);
  const [scheduled, setScheduled] = useState(() => cachedOrders?.scheduled || []);
  const [selected, setSelected] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(!cachedOrders);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(0);
  const [historyDay, setHistoryDay] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reportType, setReportType] = useState('WRONG_MEAL');
  const [reportComment, setReportComment] = useState('');
  const prevStatusRef = useRef(
    Object.fromEntries((cachedOrders?.orders || []).map((o) => [o.id, o.status])),
  );
  const playedReadyRef = useRef(new Set());

  useEffect(() => {
    onDetailOpenChange?.(Boolean(selected || selectedPlan));
    return () => onDetailOpenChange?.(false);
  }, [selected, selectedPlan, onDetailOpenChange]);

  const refresh = useCallback(async () => {
    const known = readView('orders');
    if (!known) setLoading(true);
    let rows = known?.orders || [];
    let ordersOk = false;
    try {
      const res = await ordersApi.list({ limit: 40 });
      const raw = res.data || [];
      const history = raw
        .filter((o) => DONE_STATUSES.has(o.status) && isRecent(o.createdAt))
        .slice(0, 20);
      const live = raw.filter((o) => !DONE_STATUSES.has(o.status));
      rows = [...live, ...history];
      ordersOk = true;
      for (const o of rows) {
        const prev = prevStatusRef.current[o.id];
        if (
          o.status === 'READY' &&
          prev &&
          prev !== 'READY' &&
          !playedReadyRef.current.has(o.id)
        ) {
          playedReadyRef.current.add(o.id);
          playOrderReadySound();
        }
        prevStatusRef.current[o.id] = o.status;
      }
      setOrders(rows);
      setSelected((prev) => {
        if (!prev) {
          if (!focusOrderId) return prev;
          return rows.find((o) => o.id === focusOrderId) || prev;
        }
        const found = rows.find((o) => o.id === prev.id);
        return found ? { ...prev, ...found } : prev;
      });
    } catch (e) {
      if (!known) showSnack(e.message || 'Historique indisponible');
    }
    let plans = known?.scheduled || [];
    try {
      const res = await scheduledOrdersApi.list({ limit: 20 });
      const rawPlans = res.data || [];
      const pending = rawPlans.filter((p) => p.status === 'PENDING');
      const past = rawPlans
        .filter((p) => p.status !== 'PENDING' && isRecent(p.updatedAt || p.createdAt))
        .slice(0, 20);
      plans = [...pending, ...past];
      setScheduled(plans);
    } catch {
      if (!known) setScheduled([]);
    } finally {
      if (ordersOk) writeView('orders', { orders: rows, scheduled: plans });
      setLoading(false);
    }
  }, [focusOrderId, showSnack]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const onPush = (ev) => {
      const kind = String(ev?.detail?.kind || '');
      if (kind.startsWith('ORDER_') || kind === 'NEW_ORDER') {
        refresh();
      }
    };
    window.addEventListener('kabakaba:push', onPush);
    return () => window.removeEventListener('kabakaba:push', onPush);
  }, [refresh]);

  useEffect(() => {
    if (!selected?.id) return undefined;
    let stop = false;
    const tick = async () => {
      try {
        const full = await ordersApi.get(selected.id);
        if (stop || !full) return;
        setSelected((prev) => (prev?.id === full.id ? { ...prev, ...full } : prev));
      } catch {
        /* garde l’écran actuel */
      }
    };
    const t = setInterval(tick, 8000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const stored = readStoredReview(selected.id);
    setRating(stored?.rating || 5);
    setComment(stored?.comment || '');
    setReportType('WRONG_MEAL');
    setReportComment('');
  }, [selected?.id]);

  const openOrder = async (order) => {
    setSelected(order);
    try {
      const full = await ordersApi.get(order.id);
      setSelected({ ...order, ...full, vendor: full.vendor || order.vendor });
    } catch (e) {
      showSnack(e.message || 'Détail indisponible');
    }
  };

  const openPlan = async (plan) => {
    setSelectedPlan(plan);
    try {
      setSelectedPlan(await scheduledOrdersApi.get(plan.id));
    } catch (e) {
      showSnack(e.message || 'Détail indisponible');
    }
  };

  const cancel = async (order) => {
    if (order.status !== 'CONFIRMED') return;
    const ok = window.confirm('Annuler cette commande ? Tes tickets seront remboursés.');
    if (!ok) return;
    setBusy(true);
    try {
      await ordersApi.cancel(order.id);
      showSnack('Commande annulée');
      setSelected(null);
      await refresh();
    } catch (e) {
      showSnack(e.message || 'Annulation impossible');
    } finally {
      setBusy(false);
    }
  };

  const cancelPlan = async (plan) => {
    if (plan.status !== 'PENDING') return;
    const ok = window.confirm('Annuler cette commande programmée ?');
    if (!ok) return;
    setBusy(true);
    try {
      await scheduledOrdersApi.cancel(plan.id);
      showSnack('Programmation annulée');
      setSelectedPlan(null);
      await refresh();
    } catch (e) {
      showSnack(e.message || 'Annulation impossible');
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    if (!selected?.vendorId) return;
    const stored = readStoredReview(selected.id);
    setBusy(true);
    try {
      const body = { rating: Number(rating), comment: comment.trim() || undefined };
      const saved = stored?.id
        ? await reviewsApi.update(stored.id, body)
        : await reviewsApi.create({ ...body, orderId: selected.id, vendorId: selected.vendorId });
      storeReview(selected.id, saved);
      showSnack(stored?.id ? 'Avis mis à jour' : 'Avis envoyé', 'success');
    } catch (e) {
      showSnack(e.message || 'Avis impossible');
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async () => {
    if (reportType === 'OTHER' && !reportComment.trim()) {
      showSnack('Précise le problème');
      return;
    }
    setBusy(true);
    try {
      await reportsApi.create({
        orderId: selected.id,
        type: reportType,
        comment: reportComment.trim() || undefined,
      });
      setReportComment('');
      showSnack('Signalement envoyé', 'success');
    } catch (e) {
      showSnack(e.message || 'Signalement impossible');
    } finally {
      setBusy(false);
    }
  };

  if (selectedPlan) {
    const planItems = Array.isArray(selectedPlan.items) ? selectedPlan.items : [];
    const canteen = selectedPlan.vendor?.canteenName || 'Cantine';
    const linkedOrder = selectedPlan.order || null;
    const orderRef =
      linkedOrder?.orderNumber ||
      linkedOrder?.displayCode ||
      orderCode(linkedOrder) || null;

    return (
      <div className="page page--flush">
        <div className="topbar">
          <button
            type="button"
            className="soft-back"
            onClick={() => setSelectedPlan(null)}
            aria-label="Retour"
          >
            <IconBack />
          </button>
          <h1>Programmée</h1>
          <div style={{ width: 40 }} />
        </div>
        <div className="list-pad">
          <div className="order-hero-card">
            <div className="order-hero-top">
              <span className={`status status--schedule-${String(selectedPlan.status || '').toLowerCase()}`}>
                {SCHEDULE_LABEL[selectedPlan.status] || selectedPlan.status}
              </span>
            </div>
            <h2>{canteen}</h2>
            <p>
              Prévue {formatTime(selectedPlan.scheduledFor)} ·{' '}
              {selectedPlan.consumptionMode === 'TAKEAWAY' ? 'À emporter' : 'Sur place'}
            </p>
            {selectedPlan.status === 'PENDING' ? (
              <p className="schedule-note">
                Le vendeur ne verra cette commande qu’à l’heure indiquée. Les tickets seront débités
                au moment du passage.
              </p>
            ) : null}
          </div>

          <div className="section-label">Articles</div>
          {planItems.length ? (
            planItems.map((item, i) => (
              <div
                key={`${item.menuId || item.componentId || 'line'}-${i}`}
                className="light-card cart-item-card"
              >
                <div className="cart-item-icon">·</div>
                <div className="cart-item-body">
                  <strong>{planItemLabel(item)}</strong>
                  <span>
                    {item.menuId ? 'Menu pré-composé' : item.componentId ? 'À la carte' : 'Ligne'}
                  </span>
                </div>
                <div className="price accent">×{Number(item.quantity || 0)}</div>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {itemCount(planItems)} article{itemCount(planItems) > 1 ? 's' : ''}
            </p>
          )}

          {selectedPlan.failureReason ? (
            <div className="hint-box hint-box--error" style={{ marginTop: 16 }}>
              {selectedPlan.failureReason}
            </div>
          ) : null}

          {selectedPlan.status === 'PLACED' && (selectedPlan.orderId || linkedOrder?.id) ? (
            <button
              type="button"
              className="btn-fill"
              style={{ marginTop: 20 }}
              onClick={async () => {
                const oid = selectedPlan.orderId || linkedOrder?.id;
                setSelectedPlan(null);
                try {
                  const full = await ordersApi.get(oid);
                  setSelected(full);
                } catch (e) {
                  showSnack(e.message || 'Commande introuvable');
                }
              }}
            >
              Voir la commande{orderRef ? ` #${orderRef}` : ''}
            </button>
          ) : null}

          {selectedPlan.status === 'PENDING' ? (
            <button
              type="button"
              className="btn-logout"
              style={{ marginTop: 20 }}
              disabled={busy}
              onClick={() => cancelPlan(selectedPlan)}
            >
              Annuler la programmation
            </button>
          ) : null}

          {selectedPlan.processedAt || selectedPlan.cancelledAt ? (
            <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
              {selectedPlan.processedAt
                ? `Traitée ${formatTime(selectedPlan.processedAt)}`
                : null}
              {selectedPlan.cancelledAt
                ? `Annulée ${formatTime(selectedPlan.cancelledAt)}`
                : null}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (selected) {
    const storedReview = readStoredReview(selected.id);
    const canReview = selected.status === 'RECEIVED';
    const canReport = selected.status === 'READY' || selected.status === 'RECEIVED';
    const steps = ['Envoyée', 'Préparation', 'Prête', 'Retirée'];
    const progress =
      selected.status === 'CONFIRMED'
        ? 1
        : selected.status === 'IN_PREPARATION'
          ? 2
          : selected.status === 'READY'
            ? 3
            : selected.status === 'RECEIVED'
              ? 4
              : 0;
    const failed = selected.status === 'CANCELLED';
    const code = orderCode(selected) || '—';
    const statusLabel =
      selected.status === 'READY' ? 'Prête à retirer' : ORDER_STATUS_LABEL[selected.status];

    return (
      <div className="page page--flush">
        <div className="topbar">
          <button
            type="button"
            className="soft-back"
            onClick={() => setSelected(null)}
            aria-label="Retour"
          >
            <IconBack />
          </button>
          <h1>Commande</h1>
          <div style={{ width: 40 }} />
        </div>
        <div className="list-pad">
          <div className="order-hero-card">
            <div className="order-hero-top">
              <span className={`status ${selected.status}`}>{statusLabel}</span>
              <span className="order-hero-ref">#{code}</span>
            </div>
            <h2>{selected.vendor?.canteenName || 'Cantine'}</h2>
            <p>{formatTime(selected.createdAt)}</p>
            <div className="order-timeline">
              {steps.map((label, i) => {
                const active = !failed && i < progress;
                const current = !failed && i === progress - 1;
                return (
                  <div key={label} className="order-timeline-step">
                    {i > 0 ? (
                      <span className={`order-timeline-line${i < progress && !failed ? ' on' : ''}`} />
                    ) : null}
                    <span className={`order-timeline-dot${active ? ' on' : ''}${current ? ' current' : ''}`} />
                    <span className="order-timeline-label">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {failed ? (
            <div className="cancel-banner">
              <strong>Commande annulée</strong>
              <p>
                {selected.cancellationReason?.trim()
                  ? selected.cancellationReason.trim()
                  : 'Aucun motif précisé.'}
              </p>
            </div>
          ) : null}

          <div className="pickup-code-card">
            <div className="kicker kicker--muted">Ta commande</div>
            <strong>{code}</strong>
            <p>Donne ce numéro au comptoir.</p>
          </div>

          <div className="section-label">Ton repas</div>
          {(selected.items || []).map((item) => (
            <div key={item.id || `${item.name}-${item.quantity}`} className="light-card meal-line">
              <div className="meal-line-mark" aria-hidden>
                {item.menuId ? 'Menu' : 'Plat'}
              </div>
              <div className="cart-item-body">
                <strong>{item.name}</strong>
                <span>
                  {item.quantity} part{Number(item.quantity) > 1 ? 's' : ''}
                </span>
              </div>
              <div className="price accent">
                {formatTicketCount(Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0))}
              </div>
            </div>
          ))}

          <div className="light-card summary-card">
            <div className="summary-row summary-row--total">
              <span>Total</span>
              <strong className="accent">{formatTicketCount(selected.totalTickets)} tickets</strong>
            </div>
          </div>

          {selected.status === 'CONFIRMED' ? (
            <button
              type="button"
              className="btn-logout"
              style={{ marginTop: 16 }}
              disabled={busy}
              onClick={() => cancel(selected)}
            >
              Annuler la commande
            </button>
          ) : null}

          {canReview ? (
            <div style={{ marginTop: 28 }}>
              <div className="kicker kicker--muted">Avis</div>
              <div className="section-title">
                {storedReview ? 'Modifier ton avis' : 'Noter ta dernière commande'}
              </div>
              <div className="mode-row" style={{ marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`mode-chip${rating === n ? ' active' : ''}`}
                    onClick={() => setRating(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="field">
                <label>Commentaire optionnel</label>
                <div className="input-shell">
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Ton retour"
                    maxLength={500}
                  />
                </div>
              </div>
              <button type="button" className="btn-fill" disabled={busy} onClick={submitReview}>
                {storedReview ? 'Mettre à jour' : 'Envoyer l’avis'}
              </button>
            </div>
          ) : null}

          {canReport ? (
            <div style={{ marginTop: 28 }}>
              <div className="kicker kicker--muted">Signalement</div>
              <div className="section-title">Un problème sur cette commande</div>
              <div className="mode-row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                {REPORT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    className={`mode-chip${reportType === type.value ? ' active' : ''}`}
                    onClick={() => setReportType(type.value)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              <div className="field">
                <label>{reportType === 'OTHER' ? 'Précision' : 'Précision (optionnelle)'}</label>
                <div className="input-shell">
                  <input
                    value={reportComment}
                    onChange={(e) => setReportComment(e.target.value)}
                    maxLength={500}
                    placeholder="Décris le problème"
                  />
                </div>
              </div>
              <button type="button" className="btn-outline" disabled={busy} onClick={submitReport}>
                Envoyer le signalement
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const activeTab = ORDER_TABS[tab];
  const isScheduleTab = activeTab.key === 'scheduled';
  const filtered = isScheduleTab
    ? []
    : orders
        .filter((o) => (activeTab.statuses || []).includes(o.status))
        .filter(
          (o) =>
            activeTab.key !== 'history' || dayOffset(o.createdAt) === historyDay,
        )
        .slice(0, 20);
  const pendingPlans = scheduled.filter((p) => p.status === 'PENDING');
  const historyPlans = scheduled.filter(
    (p) =>
      p.status !== 'PENDING' &&
      dayOffset(p.updatedAt || p.createdAt) === historyDay,
  );
  const pendingCount = pendingPlans.length;

  const renderPlanCard = (plan) => (
    <button
      key={plan.id}
      type="button"
      className="order-card order-card--rich"
      onClick={() => openPlan(plan)}
    >
      <div className="order-card-top">
        <div className="order-vendor-tile order-vendor-tile--schedule">⏱</div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <h3>{plan.vendor?.canteenName || 'Cantine'}</h3>
          <p>Prévue {formatTime(plan.scheduledFor)}</p>
        </div>
        <span className={`status status--schedule-${String(plan.status || '').toLowerCase()}`}>
          {SCHEDULE_LABEL[plan.status] || plan.status}
        </span>
      </div>
      <p className="order-card-total">
        {itemCount(plan.items)} article{itemCount(plan.items) > 1 ? 's' : ''} ·{' '}
        {plan.consumptionMode === 'TAKEAWAY' ? 'À emporter' : 'Sur place'}
        {plan.status === 'PLACED' && plan.order?.orderNumber
          ? ` · #${plan.order.orderNumber}`
          : ''}
        {plan.failureReason ? ` · ${plan.failureReason}` : ''}
      </p>
    </button>
  );

  return (
    <div className="page page--flush">
      <div className="hero hero--orders">
        <div className="hero-top">
          <div>
            {!embedded ? (
              <button type="button" className="soft-back soft-back--on-dark" onClick={onBack} aria-label="Retour" style={{ marginBottom: 10 }}>
                <IconBack />
              </button>
            ) : null}
            <div className="hero-greet">Suivi</div>
            <div className="hero-name">Mes commandes</div>
          </div>
        </div>
      </div>

      <div className="sheet-body">
        <div className="light-tabs light-tabs--scroll">
          {ORDER_TABS.map((t, i) => (
            <button
              key={t.key}
              type="button"
              className={`light-tab${tab === i ? ' active' : ''}`}
              onClick={() => setTab(i)}
            >
              {t.label}
              {t.key === 'scheduled' && pendingCount > 0 ? (
                <span className="light-tab-badge">{pendingCount}</span>
              ) : null}
            </button>
          ))}
        </div>

        {activeTab.key === 'history' ? (
          <div className="light-tabs" style={{ marginTop: 10 }}>
            {['Aujourd’hui', 'Hier'].map((label, i) => (
              <button
                key={label}
                type="button"
                className={`light-tab${historyDay === i ? ' active' : ''}`}
                onClick={() => setHistoryDay(i)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : isScheduleTab ? (
          <>
            {pendingCount >= 5 ? (
              <div className="hint-box" style={{ marginBottom: 14 }}>
                Maximum atteint : 5 commandes programmées en attente.
              </div>
            ) : null}
            {pendingPlans.length ? (
              <>
                <div className="kicker">En attente</div>
                {pendingPlans.map(renderPlanCard)}
              </>
            ) : null}
            {historyPlans.length ? (
              <>
                <div className="kicker" style={{ marginTop: pendingPlans.length ? 22 : 0 }}>
                  Historique
                </div>
                {historyPlans.map(renderPlanCard)}
              </>
            ) : null}
            {!scheduled.length ? (
              <div className="empty-state">
                <h3>Aucune commande programmée</h3>
                <p>
                  Depuis le panier, choisis « Programmer » pour réserver un créneau (15 min à 24 h).
                </p>
              </div>
            ) : null}
          </>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>
              {activeTab.key === 'confirmed'
                ? 'Aucune commande confirmée'
                : activeTab.key === 'active'
                  ? 'Rien en préparation'
                  : historyDay === 0
                    ? 'Rien aujourd’hui'
                    : 'Rien hier'}
            </h3>
            <p>
              {activeTab.key === 'confirmed'
                ? 'Tes commandes confirmées apparaîtront ici.'
                : activeTab.key === 'active'
                  ? 'Les commandes en préparation ou prêtes s’affichent ici.'
                  : 'Seules les commandes du jour choisi restent visibles, 20 maximum.'}
            </p>
          </div>
        ) : (
          filtered.map((order) => {
            const progress =
              order.status === 'CONFIRMED'
                ? 1
                : order.status === 'IN_PREPARATION'
                  ? 2
                  : order.status === 'READY'
                    ? 3
                    : order.status === 'RECEIVED'
                      ? 4
                      : 0;
            const steps = ['Confirmée', 'En préparation', 'Prête', 'Retirée'];
            return (
              <button
                key={order.id}
                type="button"
                className="order-card order-card--rich"
                onClick={() => openOrder(order)}
              >
                <div className="order-card-top">
                  <div className="order-vendor-tile">
                    {(order.vendor?.canteenName || 'C').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <h3>{order.vendor?.canteenName || 'Cantine'}</h3>
                    <p>{orderCode(order) || 'Commande'}</p>
                  </div>
                  <span className={`status ${order.status}`}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </span>
                </div>
                {progress > 0 ? (
                  <div className="order-progress">
                    {steps.map((label, i) => (
                      <span
                        key={label}
                        className={`order-progress-step${i < progress ? ' on' : ''}`}
                        title={label}
                      />
                    ))}
                  </div>
                ) : null}
                <p className="order-card-total">
                  {formatTime(order.createdAt)} · {itemCount(order.items)} plat
                  {itemCount(order.items) > 1 ? 's' : ''} · {formatTicketCount(order.totalTickets)}{' '}
                  tickets ·{' '}
                  {order.consumptionMode === 'TAKEAWAY' ? 'À emporter' : 'Sur place'}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
