import { useCallback, useEffect, useState } from 'react';
import { ordersApi, reportsApi, reviewsApi, scheduledOrdersApi } from '../lib/api';
import { ORDER_STATUS_LABEL, formatTickets, formatTime } from '../lib/format';
import { IconBack } from '../components/icons';

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

export default function OrdersPage({
  embedded = true,
  focusOrderId,
  onBack,
  showSnack,
}) {
  const [orders, setOrders] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reportType, setReportType] = useState('WRONG_MEAL');
  const [reportComment, setReportComment] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersApi.list({ limit: 40 });
      const data = res.data || [];
      setOrders(data);
      if (focusOrderId) {
        const found = data.find((o) => o.id === focusOrderId);
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
    return (
      <div className="page">
        <div className="topbar">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSelected(null)}
            aria-label="Retour"
          >
            <IconBack />
          </button>
          <h1>Commande #{selected.orderNumber}</h1>
          <div style={{ width: 40 }} />
        </div>
        <div className="list-pad">
          <span className={`status ${selected.status}`}>
            {ORDER_STATUS_LABEL[selected.status]}
          </span>
          <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
            {selected.vendor?.canteenName} · {formatTime(selected.createdAt)}
          </p>
          <div style={{ marginTop: 16 }}>
            {(selected.items || []).map((item) => (
              <div key={item.id} className="item-card">
                <div style={{ flex: 1 }}>
                  <h3>
                    {item.quantity}× {item.name}
                  </h3>
                </div>
                <div className="price">
                  {formatTickets(Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontWeight: 800 }}>
            Total {formatTickets(Number(selected.totalTickets ?? 0))}
          </div>
          {selected.status === 'CONFIRMED' ? (
            <button
              type="button"
              className="btn-outline"
              style={{ marginTop: 20, borderColor: 'var(--red)', color: 'var(--red)' }}
              disabled={busy}
              onClick={() => cancel(selected)}
            >
              Annuler la commande
            </button>
          ) : null}

          {canReview ? (
            <div style={{ marginTop: 28 }}>
              <div className="kicker">Avis</div>
              <div className="section-title">{storedReview ? 'Modifier ton avis' : 'Noter cette commande'}</div>
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
                <label>Commentaire (optionnel)</label>
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
              <div className="kicker">Signalement</div>
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

  return (
    <div className="page">
      {!embedded ? (
        <div className="topbar">
          <button type="button" className="icon-btn" onClick={onBack} aria-label="Retour">
            <IconBack />
          </button>
          <h1>Mes commandes</h1>
          <div style={{ width: 40 }} />
        </div>
      ) : (
        <div className="topbar">
          <div style={{ width: 40 }} />
          <h1>Mes commandes</h1>
          <div style={{ width: 40 }} />
        </div>
      )}

      <div className="list-pad">
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : (
          <>
            {scheduled.length ? (
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
            {orders.length === 0 && scheduled.length === 0 ? (
              <div className="empty">
                <h3>Pas encore de commande</h3>
                <p>Tes commandes confirmées apparaîtront ici.</p>
              </div>
            ) : (
              orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  className="order-card"
                  onClick={() => openOrder(order)}
                >
                  <h3>
                    #{order.orderNumber} · {order.vendor?.canteenName || 'Cantine'}
                  </h3>
                  <p>
                    {formatTime(order.createdAt)} · {formatTickets(order.totalTickets)}
                  </p>
                  <span className={`status ${order.status}`}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </span>
                </button>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
