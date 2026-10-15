import { useCallback, useEffect, useState } from 'react';
import { ordersApi } from '../lib/api';
import { ORDER_STATUS_LABEL, formatTickets, formatTime } from '../lib/format';
import { IconBack } from '../components/icons';

export default function OrdersPage({
  embedded = true,
  focusOrderId,
  onBack,
  showSnack,
}) {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersApi.list({ limit: 40 });
      setOrders(res.data || []);
      if (focusOrderId) {
        const found = (res.data || []).find((o) => o.id === focusOrderId);
        if (found) setSelected(found);
      }
    } catch (e) {
      showSnack(e.message || 'Historique indisponible');
    } finally {
      setLoading(false);
    }
  }, [focusOrderId, showSnack]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

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

  if (selected) {
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
        ) : orders.length === 0 ? (
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
              onClick={() => setSelected(order)}
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
      </div>
    </div>
  );
}
