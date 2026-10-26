import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { orderItems, orderSubtotal, plateTotal, useCart } from '../context/CartContext';
import { catalogApi, ordersApi, scheduledOrdersApi, vendorsApi } from '../lib/api';
import { CAPACITY_LABEL, formatTicketCount } from '../lib/format';
import { signalSoldAloneError, soldAloneViolation } from '../lib/plate';
import { IconBack } from '../components/icons';
import { useConfirm } from '../components/ConfirmDialog';

function lineCost(line, parts) {
  return (line.quantity || 0) * parts * (line.unitPrice || 0);
}

function plateSummary(plate) {
  const parts = plate.quantity || 1;
  return plate.lines
    .map((line) => {
      const qty = (line.quantity || 0) * parts;
      const cost = lineCost(line, parts);
      const qtyLabel = qty > 1 ? ` x${qty}` : '';
      return `${line.name}${qtyLabel} ${formatTicketCount(cost)}`;
    })
    .join(' · ');
}

function PlateBlock({ plate, options, open, onToggle, onQty, onRemove, onMode, onTakeaway }) {
  const parts = plate.quantity || 1;
  const away = plate.consumptionMode === 'TAKEAWAY';
  return (
    <article className={`cart-plate${open ? ' is-open' : ''}`}>
      <div className="cart-plate-top">
        <button type="button" className="cart-plate-toggle" aria-expanded={open} onClick={onToggle}>
          <span className={`roll-chevron${open ? ' is-open' : ''}`} aria-hidden />
          <span className="cart-plate-copy">
            <strong>{plate.title}</strong>
            <span>{plateSummary(plate)}</span>
          </span>
        </button>
        <div className="cart-plate-side">
          <strong>{formatTicketCount(plateTotal(plate))} tickets</strong>
          <button type="button" className="cart-plate-trash" onClick={onRemove} aria-label="Retirer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        </div>
      </div>
      <div className="cart-plate-bar">
        <div className="cart-plate-qty">
          <button type="button" className="qty-btn" onClick={() => onQty(parts - 1)} aria-label="Retirer une part">
            −
          </button>
          <strong>{parts}</strong>
          <button type="button" className="qty-btn" onClick={() => onQty(parts + 1)} aria-label="Ajouter une part">
            +
          </button>
        </div>
        <div className="plate-pack">
          <button
            type="button"
            className={`plate-chip${!away ? ' on' : ''}`}
            onClick={() => onMode('ON_SITE')}
          >
            Sur place
          </button>
          <button
            type="button"
            className={`plate-chip${away ? ' on' : ''}`}
            disabled={!options.length}
            onClick={() => onMode('TAKEAWAY')}
          >
            À emporter
          </button>
        </div>
      </div>
      {away ? (
        <div className="plate-pack-options">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`plate-chip${plate.takeawayOptionId === opt.id ? ' on' : ''}`}
              onClick={() => onTakeaway(opt.id)}
            >
              {opt.name}
              {Number(opt.priceTickets) > 0 ? ` +${formatTicketCount(opt.priceTickets)}` : ''}
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <ul className="cart-plate-lines">
          {plate.lines.map((line) => {
            const qty = (line.quantity || 0) * parts;
            return (
              <li key={line.componentId || line.menuId}>
                <span>{line.name}</span>
                <span>{qty}</span>
                <strong>{formatTicketCount(lineCost(line, parts))} tickets</strong>
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}

export default function CartPage({
  onBack,
  onOrdered,
  onScheduled,
  onDiscover,
  onOpenCanteen,
  onRecharge,
  showSnack,
}) {
  const { user, refreshMe } = useAuth();
  const cart = useCart();
  const confirm = useConfirm();
  const [optionsByVendor, setOptionsByVendor] = useState({});
  const [vendors, setVendors] = useState({});
  const [paying, setPaying] = useState(false);
  const [openPlates, setOpenPlates] = useState({});

  const vendorKey = cart.orders.map((order) => order.vendorId).join(',');

  useEffect(() => {
    if (!vendorKey) {
      setOptionsByVendor({});
      setVendors({});
      return undefined;
    }
    let cancelled = false;
    const ids = vendorKey.split(',');
    Promise.all(
      ids.map(async (id) => {
        const [options, vendor] = await Promise.all([
          catalogApi.takeawayOptions(id).catch(() => []),
          vendorsApi.get(id).catch(() => null),
        ]);
        return [id, Array.isArray(options) ? options : [], vendor];
      }),
    ).then((rows) => {
      if (cancelled) return;
      const options = {};
      const nextVendors = {};
      for (const [id, list, vendor] of rows) {
        options[id] = list;
        nextVendors[id] = vendor;
      }
      setOptionsByVendor(options);
      setVendors(nextVendors);
    });
    return () => {
      cancelled = true;
    };
  }, [vendorKey]);

  const fees = useMemo(() => {
    const byVendor = {};
    for (const order of cart.orders) {
      const options = optionsByVendor[order.vendorId] || [];
      byVendor[order.vendorId] = order.plates.reduce((sum, plate) => {
        if (plate.consumptionMode !== 'TAKEAWAY' || !plate.takeawayOptionId) return sum;
        const opt = options.find((item) => item.id === plate.takeawayOptionId);
        return sum + Number(opt?.priceTickets ?? 0);
      }, 0);
    }
    return byVendor;
  }, [cart.orders, optionsByVendor]);

  const dueNow = cart.orders.reduce((sum, order) => {
    if (order.when === 'LATER') return sum;
    return sum + orderSubtotal(order) + (fees[order.vendorId] || 0);
  }, 0);
  const dueLater = cart.orders.reduce((sum, order) => {
    if (order.when !== 'LATER') return sum;
    return sum + orderSubtotal(order) + (fees[order.vendorId] || 0);
  }, 0);
  const balance = Number(user?.walletBalance ?? 0);
  const canPay = cart.orders.length > 0 && balance >= dueNow;

  const confirmClearCart = async () => {
    if (!cart.orders.length) return;
    const ok = await confirm({
      title: 'Vider le panier',
      message: 'Tous les plats seront retirés.',
      confirmLabel: 'Vider',
      danger: true,
    });
    if (!ok) return;
    cart.clear();
    showSnack?.('Panier vidé', 'success');
  };

  const validateOrder = (order) => {
    const items = orderItems(order);
    if (items.some((line) => line.quantity > 50)) {
      return 'La quantité d’un article ne peut pas dépasser 50';
    }
    for (const group of shipments(order)) {
      const plateError = soldAloneViolation(orderItems({ plates: group.plates }));
      if (plateError) return plateError;
    }
    if (order.plates.some((plate) => plate.consumptionMode === 'TAKEAWAY' && !plate.takeawayOptionId)) {
      return `Choisis l’emporté de chaque plat chez ${order.vendorName}`;
    }
    if (order.when === 'LATER') {
      const when = new Date(order.scheduleAt);
      if (Number.isNaN(when.getTime())) return `Choisis une heure pour ${order.vendorName}`;
      const lead = when.getTime() - Date.now();
      if (lead < 15 * 60 * 1000 || lead > 24 * 60 * 60 * 1000) {
        return 'L’heure doit être entre 15 minutes et 24 heures';
      }
    } else {
      const status = String(vendors[order.vendorId]?.capacityStatus || '').toUpperCase();
      if (status && status !== 'OPEN') {
        return status === 'BUSY'
          ? `${order.vendorName} est occupée — programme plutôt ce repas.`
          : `${order.vendorName} n’accepte plus de commandes.`;
      }
    }
    return null;
  };

  const shipments = (order) => {
    const groups = [];
    const onSite = order.plates.filter((plate) => plate.consumptionMode !== 'TAKEAWAY');
    if (onSite.length) groups.push({ mode: 'ON_SITE', optionId: null, plates: onSite });
    for (const plate of order.plates) {
      if (plate.consumptionMode === 'TAKEAWAY') {
        groups.push({ mode: 'TAKEAWAY', optionId: plate.takeawayOptionId, plates: [plate] });
      }
    }
    return groups;
  };

  const orderBody = (order, group) => {
    const body = {
      vendorId: order.vendorId,
      consumptionMode: group.mode,
      items: orderItems({ plates: group.plates }).map((line) =>
        line.menuId
          ? { menuId: line.menuId, quantity: line.quantity }
          : { componentId: line.componentId, quantity: line.quantity },
      ),
    };
    if (group.mode === 'TAKEAWAY') body.takeawayOptionId = group.optionId;
    return body;
  };

  const submit = async () => {
    if (!cart.orders.length) {
      showSnack?.('Ajoute un plat au panier');
      return;
    }
    for (const order of cart.orders) {
      const error = validateOrder(order);
      if (error) {
        if (error.includes('ne se vend pas tout seul')) signalSoldAloneError(error, showSnack);
        else showSnack?.(error);
        return;
      }
    }
    if (balance < dueNow) {
      showSnack?.('Solde insuffisant — recharge ton portefeuille');
      return;
    }
    setPaying(true);
    let lastNowId = null;
    let scheduled = false;
    try {
      for (const order of cart.orders) {
        for (const group of shipments(order)) {
          const body = orderBody(order, group);
          if (order.when === 'LATER') {
            await scheduledOrdersApi.create({
              ...body,
              scheduledFor: new Date(order.scheduleAt).toISOString(),
            });
            scheduled = true;
          } else {
            const created = await ordersApi.create(body);
            lastNowId = created?.id || lastNowId;
          }
          cart.dropPlates(order.vendorId, group.plates.map((plate) => plate.id));
        }
      }
      cart.clear();
      await refreshMe();
      if (lastNowId) {
        showSnack?.(scheduled ? 'Commandes envoyées' : 'Commande confirmée', 'success');
        onOrdered(lastNowId);
      } else {
        showSnack?.('Commande programmée. Les tickets seront débités à l’heure prévue.', 'success');
        if (onScheduled) onScheduled();
        else onBack();
      }
    } catch (e) {
      showSnack?.(e.message || 'Commande impossible');
    } finally {
      setPaying(false);
    }
  };

  const filled = cart.orders.length > 0;

  return (
    <div className={`page page--flush${filled ? ' page--sticky' : ''}`}>
      <div className="topbar">
        <button type="button" className="soft-back" onClick={onBack} aria-label="Retour">
          <IconBack />
        </button>
        <h1>Mon panier</h1>
        {filled ? (
          <div className="topbar-actions">
            <button type="button" className="icon-btn" onClick={confirmClearCart} aria-label="Vider le panier">
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

      <div className="list-pad" style={{ paddingBottom: filled ? 110 : 24 }}>
        {!filled ? (
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
            {cart.orders.map((order) => {
              const vendor = vendors[order.vendorId];
              const options = (optionsByVendor[order.vendorId] || []).filter((opt) => opt.isActive !== false);
              const fee = fees[order.vendorId] || 0;
              const items = orderItems(order);
              const plateError = soldAloneViolation(items);
              return (
                <section key={order.vendorId} className="cart-order">
                  <header className="cart-order-head">
                    <div>
                      <strong>{order.vendorName}</strong>
                      <span>
                        {order.plates.reduce((sum, plate) => sum + plate.quantity, 0)} plat
                        {order.plates.reduce((sum, plate) => sum + plate.quantity, 0) > 1 ? 's' : ''}
                      </span>
                    </div>
                    {vendor ? (
                      <span className={`status-pill ${String(vendor.capacityStatus || 'CLOSED').toLowerCase()}`}>
                        {CAPACITY_LABEL[vendor.capacityStatus] || 'Fermée'}
                      </span>
                    ) : null}
                  </header>

                  {plateError ? <p className="cart-order-alert">{plateError}</p> : null}

                  {order.plates.map((plate) => (
                    <PlateBlock
                      key={plate.id}
                      plate={plate}
                      options={options}
                      open={Boolean(openPlates[plate.id])}
                      onToggle={() =>
                        setOpenPlates((current) => ({ ...current, [plate.id]: !current[plate.id] }))
                      }
                      onQty={(quantity) => {
                        if (quantity < 1) return;
                        if (plate.lines.some((line) => line.quantity * quantity > 50)) {
                          showSnack?.('La quantité d’un article ne peut pas dépasser 50');
                          return;
                        }
                        cart.setPlateQty(order.vendorId, plate.id, quantity);
                      }}
                      onRemove={() => cart.removePlate(order.vendorId, plate.id)}
                      onMode={(mode) => cart.setPlateMode(order.vendorId, plate.id, mode)}
                      onTakeaway={(id) => cart.setPlateTakeaway(order.vendorId, plate.id, id)}
                    />
                  ))}

                  <button
                    type="button"
                    className="cart-order-more"
                    onClick={() => onOpenCanteen?.(order.vendorId)}
                  >
                    + Ajouter d’autres plats de cette cantine
                  </button>

                  <div className="cart-when">
                    <span>Quand</span>
                    <button
                      type="button"
                      className={`plate-chip${order.when !== 'LATER' ? ' on' : ''}`}
                      onClick={() => cart.setWhen(order.vendorId, 'NOW')}
                    >
                      Maintenant
                    </button>
                    <button
                      type="button"
                      className={`plate-chip${order.when === 'LATER' ? ' on' : ''}`}
                      onClick={() => cart.setWhen(order.vendorId, 'LATER')}
                    >
                      Programmer
                    </button>
                  </div>
                  {order.when === 'LATER' ? (
                    <div className="field">
                      <div className="input-shell">
                        <input
                          type="datetime-local"
                          value={order.scheduleAt}
                          onChange={(e) => cart.setScheduleAt(order.vendorId, e.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="cart-order-sum">
                    <div className="summary-row">
                      <span>Plats</span>
                      <strong>{formatTicketCount(orderSubtotal(order))} tickets</strong>
                    </div>
                    {fee > 0 ? (
                      <div className="summary-row">
                        <span>Emporté</span>
                        <strong>{formatTicketCount(fee)} tickets</strong>
                      </div>
                    ) : null}
                    <div className="summary-row summary-row--total">
                      <span>Total</span>
                      <strong>{formatTicketCount(orderSubtotal(order) + fee)} tickets</strong>
                    </div>
                  </div>
                </section>
              );
            })}

            <div className="light-card summary-card">
              {dueNow > 0 ? (
                <div className="summary-row summary-row--total">
                  <span>À payer maintenant</span>
                  <strong>{formatTicketCount(dueNow)} tickets</strong>
                </div>
              ) : null}
              {dueLater > 0 ? (
                <div className="summary-row summary-row--total">
                  <span>Débité à l’heure prévue</span>
                  <strong>{formatTicketCount(dueLater)} tickets</strong>
                </div>
              ) : null}
              <div className="summary-row">
                <span>Solde actuel</span>
                <strong>{formatTicketCount(balance)} tickets</strong>
              </div>
              <div className="summary-row">
                <span>Il te restera</span>
                <strong>{formatTicketCount(Math.max(0, balance - dueNow))} tickets</strong>
              </div>
            </div>
          </>
        )}
      </div>

      {filled ? (
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
            disabled={paying}
            onClick={() => {
              if (!canPay) {
                if (onRecharge) onRecharge();
                else showSnack?.('Solde insuffisant — Recharger');
                return;
              }
              submit();
            }}
          >
            {paying ? 'Confirmation…' : canPay ? 'Confirmer' : 'Solde insuffisant — Recharger'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
