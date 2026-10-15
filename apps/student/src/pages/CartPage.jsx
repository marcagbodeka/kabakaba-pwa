import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { catalogApi, ordersApi } from '../lib/api';
import { formatTickets } from '../lib/format';
import { IconBack } from '../components/icons';

export default function CartPage({ onBack, onOrdered, showSnack }) {
  const { user, refreshMe } = useAuth();
  const cart = useCart();
  const [options, setOptions] = useState([]);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!cart.vendorId) {
      setOptions([]);
      return;
    }
    catalogApi
      .takeawayOptions(cart.vendorId)
      .then((list) => setOptions(Array.isArray(list) ? list : []))
      .catch(() => setOptions([]));
  }, [cart.vendorId]);

  const takeawayFee = useMemo(() => {
    if (cart.consumptionMode !== 'TAKEAWAY' || !cart.takeawayOptionId) return 0;
    const opt = options.find((o) => o.id === cart.takeawayOptionId);
    return Number(opt?.priceTickets ?? 0);
  }, [cart.consumptionMode, cart.takeawayOptionId, options]);

  const total = cart.subtotal + takeawayFee;
  const balance = Number(user?.walletBalance ?? 0);
  const canPay = cart.lines.length > 0 && balance >= total;
  const takeawayAvailable = options.some((o) => o.isActive !== false);

  const checkout = async () => {
    if (!canPay) {
      showSnack(
        balance < total
          ? 'Solde insuffisant pour cette commande'
          : 'Ajoute des articles au panier',
      );
      return;
    }
    if (cart.consumptionMode === 'TAKEAWAY' && !cart.takeawayOptionId) {
      showSnack('Choisis une option d’emporté');
      return;
    }
    setPaying(true);
    try {
      const body = {
        vendorId: cart.vendorId,
        consumptionMode: cart.consumptionMode,
        items: cart.lines.map((l) =>
          l.menuId
            ? { menuId: l.menuId, quantity: l.quantity }
            : { componentId: l.componentId, quantity: l.quantity },
        ),
      };
      if (cart.consumptionMode === 'TAKEAWAY') {
        body.takeawayOptionId = cart.takeawayOptionId;
      }
      const order = await ordersApi.create(body);
      cart.clear();
      await refreshMe();
      showSnack('Commande confirmée');
      onOrdered(order.id);
    } catch (e) {
      showSnack(e.message || 'Commande impossible');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="page">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Retour">
          <IconBack />
        </button>
        <h1>Mon panier</h1>
        <div style={{ width: 40 }} />
      </div>

      <div className="list-pad" style={{ paddingTop: 8 }}>
        {!cart.lines.length ? (
          <div className="empty">
            <h3>Panier vide</h3>
            <p>Choisis une cantine pour composer ton repas.</p>
          </div>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>
              {cart.vendorName}
            </p>
            {cart.lines.map((line) => {
              const key = cart.lineKey(line);
              return (
                <div key={key} className="cart-line">
                  <div style={{ flex: 1 }}>
                    <strong>{line.name}</strong>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>
                      {formatTickets(line.unitPrice)} / unité
                    </div>
                  </div>
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => cart.setQty(key, line.quantity - 1)}
                  >
                    −
                  </button>
                  <strong>{line.quantity}</strong>
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => cart.setQty(key, line.quantity + 1)}
                  >
                    +
                  </button>
                  <div className="price" style={{ minWidth: 72, textAlign: 'right' }}>
                    {formatTickets(line.unitPrice * line.quantity)}
                  </div>
                </div>
              );
            })}

            <div className="kicker" style={{ marginTop: 22 }}>
              Mode de consommation
            </div>
            <div className="mode-row">
              <button
                type="button"
                className={`mode-chip${cart.consumptionMode === 'ON_SITE' ? ' active' : ''}`}
                onClick={() => cart.setConsumption('ON_SITE')}
              >
                Sur place
              </button>
              <button
                type="button"
                className={`mode-chip${cart.consumptionMode === 'TAKEAWAY' ? ' active' : ''}`}
                disabled={!takeawayAvailable}
                onClick={() => cart.setConsumption('TAKEAWAY')}
              >
                À emporter
              </button>
            </div>

            {cart.consumptionMode === 'TAKEAWAY' ? (
              <div className="mode-row" style={{ flexDirection: 'column' }}>
                {options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`mode-chip${cart.takeawayOptionId === opt.id ? ' active' : ''}`}
                    onClick={() => cart.setTakeaway(opt.id)}
                    style={{ width: '100%' }}
                  >
                    {opt.name} · {formatTickets(opt.priceTickets)}
                  </button>
                ))}
              </div>
            ) : null}

            <div style={{ marginTop: 18, fontSize: 13.5, color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Sous-total</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {formatTickets(cart.subtotal)}
                </strong>
              </div>
              {takeawayFee > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>Emporté</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {formatTickets(takeawayFee)}
                  </strong>
                </div>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Solde</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {formatTickets(balance)}
                </strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 10,
                  fontSize: 16,
                  color: 'var(--text-primary)',
                }}
              >
                <strong>Total</strong>
                <strong>{formatTickets(total)}</strong>
              </div>
            </div>

            <button
              type="button"
              className="btn-fill"
              style={{ marginTop: 22 }}
              disabled={paying || !canPay}
              onClick={checkout}
            >
              {paying ? 'Paiement…' : 'Commander et payer'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
