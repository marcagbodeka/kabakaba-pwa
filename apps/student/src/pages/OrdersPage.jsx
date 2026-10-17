import { useCallback, useEffect, useRef, useState } from 'react';
import { ordersApi, reportsApi, reviewsApi, scheduledOrdersApi } from '../lib/api';
import {
  ORDER_STATUS_LABEL,
  formatTicketCount,
  formatTickets,
  formatTime,
} from '../lib/format';
import { IconBack } from '../components/icons';

const ORDER_TABS = [
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

function itemCount(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
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
  const [orders, setOrders] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reportType, setReportType] = useState('WRONG_MEAL');
  const [reportComment, setReportComment] = useState('');
  const prevStatusRef = useRef({});
  const playedReadyRef = useRef(new Set());

  useEffect(() => {
    onDetailOpenChange?.(Boolean(selected || selectedPlan));
    return () => onDetailOpenChange?.(false);
  }, [selected, selectedPlan, onDetailOpenChange]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersApi.list({ limit: 40 });
      const rows = res.data || [];
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
      if (focusOrderId) {
        const found = rows.find((o) => o.id === focusOrderId);
        if (found) {
          setSelected((prev) => (prev?.id === found.id ? prev : found));
        }
      }
    } catch (e) {
      showSnack(e.message || 'Historique indisponible');
    }
    try {
      const plans = await scheduledOrdersApi.list({ limit: 20 });
      setScheduled(plans.data || []);
    } catch {
      setScheduled([]);
    } finally {
      setLoading(false);
    }
  }, [focusOrderId, showSnack]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

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
    return (
      <div className="page">
        <div className="topbar">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSelectedPlan(null)}
            aria-label="Retour"
          >
            <IconBack />
          </button>
          <h1>Programmée</h1>
          <div style={{ width: 40 }} />
        </div>
        <div className="list-pad">
          <span className="status">{SCHEDULE_LABEL[selectedPlan.status] || selectedPlan.status}</span>
          <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
            {formatTime(selectedPlan.scheduledFor)} · {itemCount(selectedPlan.items)} article
            {itemCount(selectedPlan.items) > 1 ? 's' : ''}
          </p>
          <p style={{ marginTop: 8 }}>
            {selectedPlan.consumptionMode === 'TAKEAWAY' ? 'À emporter' : 'Sur place'}
          </p>
          {selectedPlan.failureReason ? (
            <p style={{ marginTop: 8 }}>{selectedPlan.failureReason}</p>
          ) : null}
          {selectedPlan.status === 'PENDING' ? (
            <button
              type="button"
              className="btn-outline"
              style={{ marginTop: 20, borderColor: 'var(--red)', color: 'var(--red)' }}
              disabled={busy}
              onClick={() => cancelPlan(selectedPlan)}
            >
              Annuler la programmation
            </button>
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
    const code = selected.displayCode || selected.orderNumber || '—';
    const statusLabel =
      selected.status === 'READY' ? 'Prête à retirer' : ORDER_STATUS_LABEL[selected.status];

    return (
      <div className="page page--flush">
        <div className="topbar">
          <button
            type="button"
            className="icon-btn"
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

          <div className="pickup-code-card">
            <div className="kicker kicker--muted">Numéro de commande</div>
            <strong>{code}</strong>
            <p>Présente ce numéro au vendeur pour récupérer ta commande.</p>
          </div>

          <div className="section-label">Articles</div>
          {(selected.items || []).map((item) => (
            <div key={item.id || `${item.name}-${item.quantity}`} className="light-card cart-item-card">
              <div className="cart-item-icon">·</div>
              <div className="cart-item-body">
                <strong>{item.name}</strong>
                <span>{item.quantity}x</span>
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
  const filtered = orders.filter((o) => activeTab.statuses.includes(o.status));

  return (
    <div className="page page--flush">
      <div className="hero hero--orders">
        <div className="hero-top">
          <div>
            {!embedded ? (
              <button type="button" className="hero-icon-btn" onClick={onBack} aria-label="Retour" style={{ marginBottom: 10 }}>
                <IconBack />
              </button>
            ) : null}
            <div className="hero-greet">Suivi</div>
            <div className="hero-name">Mes commandes</div>
          </div>
        </div>
      </div>

      <div className="sheet-body">
        <div className="light-tabs">
          {ORDER_TABS.map((t, i) => (
            <button
              key={t.key}
              type="button"
              className={`light-tab${tab === i ? ' active' : ''}`}
              onClick={() => setTab(i)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : (
          <>
            {tab === 0 && scheduled.length ? (
              <>
                <div className="kicker">Programmées</div>
                {scheduled.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className="order-card"
                    onClick={() => openPlan(plan)}
                  >
                    <h3>{formatTime(plan.scheduledFor)}</h3>
                    <p>
                      {itemCount(plan.items)} article{itemCount(plan.items) > 1 ? 's' : ''} ·{' '}
                      {plan.consumptionMode === 'TAKEAWAY' ? 'À emporter' : 'Sur place'}
                    </p>
                    <span className="status">{SCHEDULE_LABEL[plan.status] || plan.status}</span>
                  </button>
                ))}
              </>
            ) : null}
            {filtered.length === 0 && !(tab === 0 && scheduled.length) ? (
              <div className="empty-state">
                <h3>
                  {tab === 0
                    ? 'Aucune commande confirmée'
                    : tab === 1
                      ? 'Rien en préparation'
                      : 'Aucune commande passée'}
                </h3>
                <p>
                  {tab === 0
                    ? 'Tes commandes confirmées apparaîtront ici.'
                    : tab === 1
                      ? 'Les commandes en préparation ou prêtes s’affichent ici.'
                      : 'Tes commandes terminées et annulées apparaîtront ici.'}
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
                        <p>N° {order.displayCode || order.orderNumber || '—'}</p>
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
                      {formatTime(order.createdAt)} · {itemCount(order.items)} article
                      {itemCount(order.items) > 1 ? 's' : ''} · {formatTicketCount(order.totalTickets)}{' '}
                      tickets ·{' '}
                      {order.consumptionMode === 'TAKEAWAY' ? 'À emporter' : 'Sur place'}
                    </p>
                  </button>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}
