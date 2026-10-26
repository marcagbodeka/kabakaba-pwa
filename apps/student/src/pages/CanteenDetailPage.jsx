import { useEffect, useMemo, useState } from 'react';
import { catalogApi, vendorsApi } from '../lib/api';
import { orderSubtotal, useCart } from '../context/CartContext';
import { readView, writeView } from '../lib/instantView';
import { groupPlate } from '../lib/plate';
import { CAPACITY_LABEL, formatTicketCount } from '../lib/format';
import { IconBack } from '../components/icons';

const MAX_PARTS = 12;

function lineName(item) {
  return item?.localName ? `${item.name} · ${item.localName}` : item?.name || '';
}

function QtyCircles({ parts, onChange, disabled }) {
  const atMax = parts >= MAX_PARTS;
  if (!parts) {
    return (
      <button
        type="button"
        className="roll-plus"
        disabled={disabled}
        onClick={() => onChange(1)}
        aria-label="Ajouter une part"
      >
        +
      </button>
    );
  }
  return (
    <div className="roll-qty">
      <button
        type="button"
        className="roll-plus"
        disabled={disabled}
        onClick={() => onChange(parts - 1)}
        aria-label="Retirer une part"
      >
        −
      </button>
      <strong>{parts}</strong>
      <button
        type="button"
        className="roll-plus"
        disabled={disabled || atMax}
        onClick={() => onChange(parts + 1)}
        aria-label="Ajouter une part"
      >
        +
      </button>
    </div>
  );
}

function MenuRoll({ title, open, onToggle, children }) {
  return (
    <section className={`menu-roll${open ? ' is-open' : ''}`}>
      <button type="button" className="menu-roll-head" aria-expanded={open} onClick={onToggle}>
        <span className="menu-roll-title">{title}</span>
        <span className={`roll-chevron${open ? ' is-open' : ''}`} aria-hidden />
      </button>
      <div className="base-roll">
        <div className="base-roll-clip">
          <div className="menu-roll-paper">{children}</div>
        </div>
      </div>
    </section>
  );
}

function acceptsOrders(vendor) {
  const status = String(vendor?.capacityStatus || '').toUpperCase();
  return status === 'OPEN' || status === 'BUSY';
}

export default function CanteenDetailPage({ vendorId, onBack, onOpenCart, showSnack }) {
  const cart = useCart();
  const cached = readView(`canteen:${vendorId}`);
  const [vendor, setVendor] = useState(cached?.vendor || null);
  const [menus, setMenus] = useState(cached?.menus || []);
  const [components, setComponents] = useState(cached?.components || []);
  const [categories, setCategories] = useState(cached?.categories || []);
  const [loading, setLoading] = useState(!cached?.vendor);
  const [platsOpen, setPlatsOpen] = useState(false);
  const [drinksOpen, setDrinksOpen] = useState(false);
  const [openBaseId, setOpenBaseId] = useState(null);
  const [baseParts, setBaseParts] = useState({});
  const [extraParts, setExtraParts] = useState({});
  const [drinkParts, setDrinkParts] = useState({});
  const [rice, setRice] = useState({});

  useEffect(() => {
    if (!vendorId) return undefined;
    let cancelled = false;
    const known = readView(`canteen:${vendorId}`);
    if (known?.vendor) {
      setVendor(known.vendor);
      setMenus(known.menus || []);
      setComponents(known.components || []);
      setCategories(known.categories || []);
      setLoading(false);
    } else {
      setLoading(true);
    }
    (async () => {
      try {
        const [v, m, c, cats] = await Promise.all([
          vendorsApi.get(vendorId),
          catalogApi.menus(vendorId),
          catalogApi.components(vendorId),
          catalogApi.categories(vendorId),
        ]);
        if (cancelled) return;
        const next = {
          vendor: v,
          menus: Array.isArray(m) ? m : [],
          components: Array.isArray(c) ? c : [],
          categories: Array.isArray(cats) ? cats : [],
        };
        setVendor(next.vendor);
        setMenus(next.menus);
        setComponents(next.components);
        setCategories(next.categories);
        writeView(`canteen:${vendorId}`, next);
      } catch (e) {
        if (!cancelled && !readView(`canteen:${vendorId}`)?.vendor) {
          showSnack?.(e.message || 'Impossible de charger la cantine');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId, showSnack]);

  const plate = useMemo(
    () => groupPlate(components, categories),
    [components, categories],
  );
  const bases = plate.base;
  const extras = plate.extra;
  const onRice = useMemo(() => [...plate.choice, ...plate.always], [plate.choice, plate.always]);
  const drinks = plate.drink;

  const guardVendor = () => {
    if (!acceptsOrders(vendor)) {
      const label = CAPACITY_LABEL[vendor?.capacityStatus] || 'Fermée';
      showSnack?.(
        String(vendor?.capacityStatus).toUpperCase() === 'BUSY'
          ? 'Cantine occupée — réessaie un peu plus tard'
          : `Cantine ${label.toLowerCase()} — commandes indisponibles`,
      );
      return false;
    }
    return true;
  };

  const plateTickets = useMemo(() => {
    let total = 0;
    let hasBase = false;
    for (const base of bases) {
      const parts = baseParts[base.id] || 0;
      if (parts > 0 && base.available) {
        hasBase = true;
        total += Number(base.priceTickets || 0) * parts;
      }
    }
    if (hasBase) {
      for (const base of bases) {
        if (!(baseParts[base.id] > 0) || !base.available) continue;
        const picked = extraParts[base.id] || {};
        for (const extra of extras) {
          const parts = picked[extra.id] || 0;
          if (parts > 0 && extra.available) total += Number(extra.priceTickets || 0) * parts;
        }
        const sauces = rice[base.id] || {};
        for (const item of onRice) {
          if (sauces[item.id] && item.available) total += Number(item.priceTickets || 0);
        }
      }
    }
    for (const drink of drinks) {
      const parts = drinkParts[drink.id] || 0;
      if (parts > 0 && drink.available) total += Number(drink.priceTickets || 0) * parts;
    }
    return total;
  }, [bases, baseParts, extras, extraParts, drinks, drinkParts, onRice, rice]);

  const addPlate = () => {
    if (!guardVendor()) return;
    const chosen = bases.filter((base) => base.available && (baseParts[base.id] || 0) > 0);
    const chosenDrinks = drinks.filter((drink) => drink.available && (drinkParts[drink.id] || 0) > 0);
    if (!chosen.length && !chosenDrinks.length) {
      showSnack?.('Ajoute d’abord une part du plat');
      return;
    }
    const lineOf = (item, quantity) => ({
      componentId: item.id,
      name: lineName(item),
      unitPrice: Number(item.priceTickets ?? 0),
      quantity,
      soldAlone: Boolean(item.soldAlone),
    });
    for (const base of chosen) {
      const lines = [lineOf(base, baseParts[base.id])];
      const picked = extraParts[base.id] || {};
      for (const extra of extras) {
        const parts = picked[extra.id] || 0;
        if (extra.available && parts > 0) lines.push(lineOf(extra, parts));
      }
      const sauces = rice[base.id] || {};
      for (const item of onRice) {
        if (sauces[item.id] && item.available) lines.push(lineOf(item, 1));
      }
      cart.addPlate({
        vendorId,
        vendorName: vendor?.canteenName,
        title: base.name,
        lines,
      });
    }
    for (const drink of chosenDrinks) {
      cart.addPlate({
        vendorId,
        vendorName: vendor?.canteenName,
        title: drink.name,
        lines: [lineOf(drink, drinkParts[drink.id])],
      });
    }
    setBaseParts({});
    setExtraParts({});
    setRice({});
    setDrinkParts({});
    showSnack?.('Plat ajouté', 'success');
  };

  const orderHere = cart.orders.find((order) => order.vendorId === vendorId);
  const cartHere = Boolean(orderHere?.plates.length);
  const cartSubtotal = orderHere ? orderSubtotal(orderHere) : 0;
  const cartCountHere = orderHere
    ? orderHere.plates.reduce((sum, plate) => sum + plate.quantity, 0)
    : 0;

  if (loading) {
    return (
      <div className="page page--flush" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page page--flush page--sticky">
      <div className="canteen-detail-hero">
        {vendor?.bannerUrl || vendor?.logoUrl ? (
          <img src={vendor.bannerUrl || vendor.logoUrl} alt="" />
        ) : (
          <div className="canteen-detail-hero-fallback" />
        )}
        <div className="canteen-detail-hero-fade" />
        <button type="button" className="soft-back soft-back--float canteen-detail-back" onClick={onBack} aria-label="Retour">
          <IconBack />
        </button>
        <div className="canteen-detail-hero-meta">
          <span className={`status-pill ${String(vendor?.capacityStatus || 'CLOSED').toLowerCase()}`}>
            {CAPACITY_LABEL[vendor?.capacityStatus] || 'Fermée'}
          </span>
          <h1>{vendor?.canteenName || 'Cantine'}</h1>
          {vendor?.description ? <p>{vendor.description}</p> : null}
        </div>
      </div>

      <div className="list-pad canteen-detail-body">
        <div className="canteen-intro">
          <div className="kicker kicker--muted">Cantine du campus</div>
          <div className="meta-chips">
            <span className="meta-chip">{CAPACITY_LABEL[vendor?.capacityStatus] || 'Fermée'}</span>
            {bases.length ? <span className="meta-chip">Plat à composer</span> : null}
          </div>
        </div>
        <MenuRoll title="Nos plats" open={platsOpen} onToggle={() => setPlatsOpen((v) => !v)}>
          {bases.length ? (
            bases.map((item) => {
              const open = item.id === openBaseId;
              const price = Number(item.priceTickets || 0);
              const parts = baseParts[item.id] || 0;
              const pickedRice = rice[item.id] || {};
              const pickedExtras = extraParts[item.id] || {};
              return (
                <section
                  key={item.id}
                  className={`dish${open ? ' is-open' : ''}${!item.available ? ' is-off' : ''}`}
                >
                  <div className="line">
                    <button
                      type="button"
                      className="line-main"
                      disabled={!item.available}
                      aria-expanded={open}
                      onClick={() => setOpenBaseId(open ? null : item.id)}
                    >
                      <span className={`roll-chevron${open ? ' is-open' : ''}`} aria-hidden />
                      <span className="line-name">{item.name}</span>
                    </button>
                    <span className="line-price">
                      {item.available ? `${formatTicketCount(price)} tickets` : 'Indisponible'}
                    </span>
                    <QtyCircles
                      parts={parts}
                      disabled={!item.available}
                      onChange={(next) => setBaseParts((q) => ({ ...q, [item.id]: next }))}
                    />
                  </div>
                  <div className="base-roll">
                    <div className="base-roll-clip">
                      <div className="dish-paper">
                        {onRice.map((option) => {
                          const on = Boolean(pickedRice[option.id]);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              disabled={!option.available}
                              className={`rice-option${on ? ' is-on' : ''}${!option.available ? ' is-off' : ''}`}
                              onClick={() =>
                                setRice((current) => ({
                                  ...current,
                                  [item.id]: { ...current[item.id], [option.id]: !on },
                                }))
                              }
                            >
                              <span className="rice-dot" />
                              <span className="rice-label">
                                <strong>{option.name}</strong>
                                {option.localName ? <em>{option.localName}</em> : null}
                              </span>
                            </button>
                          );
                        })}
                        {extras.length ? (
                          <div className="extra-list">
                            {extras.map((extra) => {
                              const extraQty = pickedExtras[extra.id] || 0;
                              const extraPrice = Number(extra.priceTickets || 0);
                              return (
                                <div
                                  key={extra.id}
                                  className={`extra-row${!extra.available ? ' is-off' : ''}`}
                                >
                                  <span className="extra-name">{extra.name}</span>
                                  <span className="extra-price">
                                    {extra.available
                                      ? `${formatTicketCount(extraPrice)} tickets`
                                      : 'Indisponible'}
                                  </span>
                                  <QtyCircles
                                    parts={extraQty}
                                    disabled={!extra.available}
                                    onChange={(next) =>
                                      setExtraParts((q) => ({
                                        ...q,
                                        [item.id]: { ...q[item.id], [extra.id]: next },
                                      }))
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })
          ) : (
            <div className="empty-state">
              <h3>Pas de plat à composer</h3>
            </div>
          )}
        </MenuRoll>

        {drinks.length ? (
          <MenuRoll title="Jus & Boissons" open={drinksOpen} onToggle={() => setDrinksOpen((v) => !v)}>
            {drinks.map((drink) => (
              <div key={drink.id} className={`extra-row${!drink.available ? ' is-off' : ''}`}>
                <span className="extra-name">{drink.name}</span>
                <span className="extra-price">
                  {drink.available ? `${formatTicketCount(drink.priceTickets)} tickets` : 'Indisponible'}
                </span>
                <QtyCircles
                  parts={drinkParts[drink.id] || 0}
                  disabled={!drink.available}
                  onChange={(next) => setDrinkParts((q) => ({ ...q, [drink.id]: next }))}
                />
              </div>
            ))}
          </MenuRoll>
        ) : null}
      </div>

      <div className="sticky-bar sticky-bar--flutter">
        <div className="sticky-cart-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 7h15l-1.5 9h-12z" />
            <path d="M6 7 5 3H2" />
            <circle cx="9" cy="20" r="1" />
            <circle cx="17" cy="20" r="1" />
          </svg>
          {cartHere ? <span className="sticky-badge">{cartCountHere > 9 ? '9+' : cartCountHere}</span> : null}
        </div>
        <div className="meta">
          <strong>Total</strong>
          <span>
            {cartHere
              ? `${formatTicketCount(cartSubtotal)} tickets`
              : plateTickets
                ? `${formatTicketCount(plateTickets)} tickets`
                : 'Choisis ton plat'}
          </span>
        </div>
        <button
          type="button"
          className="btn-fill"
          style={{ width: 'auto', padding: '0 16px', height: 42 }}
          onClick={() => {
            if (cartHere) onOpenCart();
            else addPlate();
          }}
        >
          {cartHere ? 'Voir le panier' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}
