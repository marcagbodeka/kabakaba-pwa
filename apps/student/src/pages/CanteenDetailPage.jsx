import { useEffect, useMemo, useState } from 'react';
import { catalogApi, vendorsApi } from '../lib/api';
import { useCart } from '../context/CartContext';
import { readView, writeView } from '../lib/instantView';
import { groupPlate } from '../lib/plate';
import { CAPACITY_LABEL, formatTicketCount } from '../lib/format';
import { IconBack } from '../components/icons';

const MAX_PARTS = 12;

/** Un seul accompagnement, deux noms : français et langue locale. Aperçu, pas encore en commande. */
const ON_RICE = [
  { id: 'sauce', name: 'Sauce tomate', local: 'Nougbagba' },
  { id: 'piment', name: 'Piment noir', local: 'Fionfion' },
  { id: 'poudre', name: 'Piment en poudre', local: 'Tôtô' },
  { id: 'huile', name: 'Huile' },
];

/** Aperçu boissons, en attendant le catalogue. */
const DRINKS = [
  { id: 'bissap', name: 'Bissap', price: 100 },
  { id: 'gingembre', name: 'Jus de gingembre', price: 100 },
  { id: 'eau', name: 'Eau', price: 50 },
];

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
    if (!hasBase) return 0;
    for (const base of bases) {
      if (!(baseParts[base.id] > 0) || !base.available) continue;
      const picked = extraParts[base.id] || {};
      for (const extra of extras) {
        const parts = picked[extra.id] || 0;
        if (parts > 0 && extra.available) total += Number(extra.priceTickets || 0) * parts;
      }
    }
    return total;
  }, [bases, baseParts, extras, extraParts]);

  const addPlate = () => {
    if (!guardVendor()) return;
    const chosen = bases.filter((base) => base.available && (baseParts[base.id] || 0) > 0);
    if (!chosen.length) {
      showSnack?.('Ajoute d’abord une part du plat');
      return;
    }
    const push = (item, quantity) => {
      if (!item || quantity < 1) return;
      cart.add({
        vendorId,
        vendorName: vendor?.canteenName,
        componentId: item.id,
        name: item.name,
        unitPrice: Number(item.priceTickets ?? 0),
        quantity,
        soldAlone: Boolean(item.soldAlone),
      });
    };
    for (const base of chosen) {
      push(base, baseParts[base.id]);
      const picked = extraParts[base.id] || {};
      for (const extra of extras) {
        if (extra.available) push(extra, picked[extra.id] || 0);
      }
    }
    setBaseParts({});
    setExtraParts({});
    showSnack?.('Plat ajouté', 'success');
  };

  const cartHere = cart.vendorId === vendorId && cart.itemCount > 0;

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
                      <span className="line-price">
                        {item.available ? `${formatTicketCount(price)} tickets` : 'Indisponible'}
                      </span>
                      <span className="line-name">{item.name}</span>
                    </button>
                    <QtyCircles
                      parts={parts}
                      disabled={!item.available}
                      onChange={(next) => setBaseParts((q) => ({ ...q, [item.id]: next }))}
                    />
                  </div>
                  <div className="base-roll">
                    <div className="base-roll-clip">
                      <div className="dish-paper">
                        {ON_RICE.map((option) => {
                          const on = Boolean(pickedRice[option.id]);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              className={`rice-option${on ? ' is-on' : ''}`}
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
                                {option.local ? <em>{option.local}</em> : null}
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

        <MenuRoll title="Jus & Boissons" open={drinksOpen} onToggle={() => setDrinksOpen((v) => !v)}>
          {DRINKS.map((drink) => (
            <div key={drink.id} className="extra-row">
              <span className="extra-name">{drink.name}</span>
              <span className="extra-price">{formatTicketCount(drink.price)} tickets</span>
              <QtyCircles
                parts={drinkParts[drink.id] || 0}
                onChange={(next) => setDrinkParts((q) => ({ ...q, [drink.id]: next }))}
              />
            </div>
          ))}
        </MenuRoll>
      </div>

      <div className="sticky-bar sticky-bar--flutter">
        <div className="sticky-cart-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 7h15l-1.5 9h-12z" />
            <path d="M6 7 5 3H2" />
            <circle cx="9" cy="20" r="1" />
            <circle cx="17" cy="20" r="1" />
          </svg>
          {cartHere ? <span className="sticky-badge">{cart.itemCount > 9 ? '9+' : cart.itemCount}</span> : null}
        </div>
        <div className="meta">
          <strong>Total</strong>
          <span>
            {cartHere
              ? `${formatTicketCount(cart.subtotal)} tickets`
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
