import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { catalogApi, ordersApi, scheduledOrdersApi, vendorsApi } from '../lib/api';
import { CAPACITY_LABEL, formatTicketCount } from '../lib/format';
import { IconBack } from '../components/icons';

export default function CartPage({
  onBack,
  onOrdered,
  onScheduled,
  onDiscover,
  onRecharge,
  showSnack,
}) {
  const { user, refreshMe } = useAuth();
  const cart = useCart();
  const [options, setOptions] = useState([]);
  const [vendor, setVendor] = useState(null);
  const [paying, setPaying] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');

  useEffect(() => {
    if (!cart.vendorId) {
      setOptions([]);
      setVendor(null);
      return;
    }
    catalogApi
      .takeawayOptions(cart.vendorId)
      .then((list) => setOptions(Array.isArray(list) ? list : []))
      .catch(() => setOptions([]));
    vendorsApi
      .get(cart.vendorId)
      .then(setVendor)
      .catch(() => setVendor(null));
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

  const orderBody = () => {
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
    return body;
  };

  const confirmClearCart = () => {
    if (!cart.lines.length) return;
    const ok = window.confirm(
      'Vider le panier ? Tous les plats seront retirés.',
    );
    if (!ok) return;
    cart.clear();
    showSnack?.('Panier vidé', 'success');
  };

  const checkout = async () => {
    if (!cart.lines.length) {
      showSnack?.('Ajoute un plat au panier');
      return;
    }
    if (!canPay) {
      showSnack?.(
        balance < total ? 'Solde insuffisant — recharge ton portefeuille' : 'Ajoute un plat au panier',
      );
      return;
    }
    if (cart.consumptionMode === 'TAKEAWAY' && !cart.takeawayOptionId) {
      showSnack?.('Choisis une option d’emporté');
      return;
    }
    const status = String(vendor?.capacityStatus || '').toUpperCase();
    if (status && status !== 'OPEN') {
      showSnack?.(
        status === 'BUSY'
          ? 'Cantine occupée — programme plutôt ton repas.'
          : 'Cette cantine n’accepte plus de commandes.',
      );
      return;
    }
    setPaying(true);
    try {
      const order = await ordersApi.create(orderBody());
      cart.clear();
      await refreshMe();
      showSnack?.('Commande confirmée', 'success');
      onOrdered(order.id);
    } catch (e) {
      showSnack?.(e.message || 'Commande impossible');
    } finally {
      setPaying(false);
    }
  };

  const schedule = async () => {
    if (!cart.lines.length) {
      showSnack?.('Ajoute un plat au panier');
      return;
    }
    if (cart.consumptionMode === 'TAKEAWAY' && !cart.takeawayOptionId) {
      showSnack?.('Choisis une option d’emporté');
      return;
    }
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime())) {
      showSnack?.('Choisis une heure');
      return;
    }
    const lead = when.getTime() - Date.now();
    if (lead < 15 * 60 * 1000 || lead > 24 * 60 * 60 * 1000) {
      showSnack?.('L’heure doit être entre 15 minutes et 24 heures');
      return;
    }
    setPaying(true);
    try {
      await scheduledOrdersApi.create({
        ...orderBody(),
        scheduledFor: when.toISOString(),
      });
      cart.clear();
      setScheduleAt('');
      showSnack?.('Commande programmée. Les tickets seront débités à l’heure prévue.', 'success');
      if (onScheduled) onScheduled();
      else onBack();
    } catch (e) {
      showSnack?.(e.message || 'Programmation impossible');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className={`page page--flush${cart.lines.length ? ' page--sticky' : ''}`}>
      <div className="topbar">
        <button type="button" className="soft-back" onClick={onBack} aria-label="Retour">
          <IconBack />
        </button>
        <h1>Mon panier</h1>
        {cart.lines.length ? (
          <div className="topbar-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={confirmClearCart}
              aria-label="Vider le panier"
              title="Vider le panier"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
              </svg>
            </button>
            <span className="topbar-badge">{cart.itemCount}</span>
          </div>
        ) : (
          <div style={{ width: 40 }} />
        )}
      </div>

      <div className="list-pad" style={{ paddingBottom: cart.lines.length ? 110 : 24 }}>
        {!cart.lines.length ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 7h15l-1.5 9h-12z" />
                <path d="M6 7 5 3H2" />
                <circle cx="9" cy="20" r="1" />
                <circle cx="17" cy="20" r="1" />
              </svg>
            </div>
            <h3>Panier vide</h3>
            <p>Ajoute des plats depuis les cantines de ton campus.</p>
            <button type="button" className="btn-fill" style={{ marginTop: 16 }} onClick={onDiscover}>
              Découvrir les cantines
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="light-card canteen-header-card" onClick={onBack}>
              <div className="canteen-thumb" style={{ width: 52, height: 52, borderRadius: 14 }}>
                {vendor?.logoUrl || vendor?.bannerUrl ? (
                  <img src={vendor.logoUrl || vendor.bannerUrl} alt="" />
                ) : (
                  (cart.vendorName || 'C').slice(0, 2).toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <strong>{cart.vendorName || 'Cantine'}</strong>
                <p>
                  {cart.itemCount} plat{cart.itemCount > 1 ? 's' : ''}
                </p>
              </div>
              {vendor ? (
                <span className={`status-pill ${String(vendor.capacityStatus || 'CLOSED').toLowerCase()}`}>
                  {CAPACITY_LABEL[vendor.capacityStatus] || 'Fermée'}
                </span>
              ) : null}
            </button>

            {cart.lines.map((line) => {
              const key = cart.lineKey(line);
              return (
                <div key={key} className="light-card meal-line">
                  <div className="meal-line-mark" aria-hidden>
                    {line.menuId ? 'Menu' : 'Plat'}
                  </div>
                  <div className="cart-item-body">
                    <strong>{line.name}</strong>
                    <span>{formatTicketCount(line.unitPrice)} tickets / part</span>
                  </div>
                  <div className="qty-stepper">
                    <button type="button" className="qty-btn" onClick={() => cart.setQty(key, line.quantity - 1)}>
                      −
                    </button>
                    <strong>{line.quantity}</strong>
                    <button type="button" className="qty-btn" onClick={() => cart.setQty(key, line.quantity + 1)}>
                      +
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="section-label">Mode de consommation</div>
            <div className="mode-row mode-row--cards">
              <button
                type="button"
                className={`mode-card${cart.consumptionMode === 'ON_SITE' ? ' active' : ''}`}
                onClick={() => cart.setConsumption('ON_SITE')}
              >
                Sur place
              </button>
              <button
                type="button"
                className={`mode-card${cart.consumptionMode === 'TAKEAWAY' ? ' active' : ''}`}
                disabled={!takeawayAvailable}
                onClick={() => cart.setConsumption('TAKEAWAY')}
              >
                À emporter
              </button>
            </div>

            {cart.consumptionMode === 'TAKEAWAY' ? (
              options.length ? (
                <div className="takeaway-options">
                  {options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`takeaway-option${cart.takeawayOptionId === opt.id ? ' active' : ''}`}
                      onClick={() => cart.setTakeaway(opt.id)}
                    >
                      <span>{opt.name}</span>
                      <strong>
                        {Number(opt.priceTickets) > 0
                          ? `+${formatTicketCount(opt.priceTickets)} tickets`
                          : 'Sans supplément'}
                      </strong>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">Aucune option d’emporté pour cette cantine.</p>
              )
            ) : null}

            <div className="light-card summary-card">
              <div className="summary-row">
                <span>Sous-total</span>
                <strong>{formatTicketCount(cart.subtotal)} tickets</strong>
              </div>
              {takeawayFee > 0 ? (
                <div className="summary-row">
                  <span>Emporté</span>
                  <strong>{formatTicketCount(takeawayFee)} tickets</strong>
                </div>
              ) : null}
              <div className="summary-row summary-row--total">
                <span>Total</span>
                <strong>{formatTicketCount(total)} tickets</strong>
              </div>
              <div className="summary-row">
                <span>Solde actuel</span>
                <strong>{formatTicketCount(balance)} tickets</strong>
              </div>
              <div className="summary-row">
                <span>Il te restera</span>
                <strong>{formatTicketCount(Math.max(0, balance - total))} tickets</strong>
              </div>
            </div>

            <div className="field" style={{ marginTop: 18 }}>
              <label>Ou programmer (15 min à 24 h)</label>
              <div className="input-shell">
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              className="btn-outline"
              disabled={paying || !scheduleAt}
              onClick={schedule}
            >
              Programmer sans débiter maintenant
            </button>
          </>
        )}
      </div>

      {cart.lines.length ? (
        <div className="sticky-bar sticky-bar--checkout">
          <div className="meta">
            <strong>Ton solde</strong>
            <span style={{ color: canPay ? 'var(--green)' : 'var(--red)' }}>
              {formatTicketCount(balance)} tickets
            </span>
          </div>
          <button
            type="button"
            className="btn-fill"
            style={{ width: 'auto', minWidth: 160, padding: '0 14px', height: 44 }}
            disabled={paying || (canPay && cart.consumptionMode === 'TAKEAWAY' && !cart.takeawayOptionId)}
            onClick={() => {
              if (!canPay) {
                if (onRecharge) onRecharge();
                else showSnack?.('Solde insuffisant — Recharger');
                return;
              }
              checkout();
            }}
          >
            {paying
              ? 'Confirmation…'
              : canPay
                ? 'Confirmer la commande'
                : 'Solde insuffisant — Recharger'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
