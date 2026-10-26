import { useEffect, useMemo, useState } from 'react';
import { catalogApi, vendorsApi } from '../lib/api';
import { useCart } from '../context/CartContext';
import { readView, writeView } from '../lib/instantView';
import { groupPlate } from '../lib/plate';
import { CAPACITY_LABEL, formatTicketCount } from '../lib/format';
import { IconBack } from '../components/icons';

const MAX_PARTS = 12;

/** Accompagnements du riz : choix unique, sans quantité. Le backend viendra après. */
const ON_RICE = [
  { id: 'sauce', options: ['Sauce tomate', 'Nougbagba'] },
  { id: 'piment', options: ['Piment noir', 'Fionfion'] },
  { id: 'poudre', options: ['Piment en poudre', 'Tôtô'] },
  { id: 'huile', options: ['Huile'] },
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
  const [openBaseId, setOpenBaseId] = useState(null);
  const [extraParts, setExtraParts] = useState({});
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
  const selectedBase = bases.find((c) => c.id === openBaseId && c.available) || null;

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
    if (!selectedBase) return 0;
    let total = Number(selectedBase.priceTickets || 0);
    for (const extra of extras) {
      const parts = extraParts[extra.id] || 0;
      if (parts > 0 && extra.available) total += Number(extra.priceTickets || 0) * parts;
    }
    return total;
  }, [selectedBase, extras, extraParts]);

  const addPlate = () => {
    if (!guardVendor()) return;
    if (!selectedBase) {
      showSnack?.('Choisis d’abord le plat de base, par exemple le riz');
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
    push(selectedBase, 1);
    for (const extra of extras) {
      if (extra.available) push(extra, extraParts[extra.id] || 0);
    }
    setExtraParts({});
    setRice({});
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
        {bases.length ? (
          bases.map((item) => {
            const open = item.id === openBaseId;
            const price = Number(item.priceTickets || 0);
            return (
              <section
                key={item.id}
                className={`base-sheet${!item.available ? ' is-off' : ''}${open ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="base-name"
                  disabled={!item.available}
                  aria-expanded={open}
                  onClick={() => {
                    setOpenBaseId(open ? null : item.id);
                    if (!open) {
                      setExtraParts({});
                      setRice({});
                    }
                  }}
                >
                  <span>{item.name}</span>
                  {!item.available ? <em>Indisponible</em> : null}
                </button>
                <div className="base-roll">
                  <div className="base-roll-clip">
                    <div className="base-roll-paper">
                      <div className="roll-cap" aria-hidden />
                      {ON_RICE.map((group) => (
                        <div key={group.id} className="rice-group" role="radiogroup">
                          {group.options.map((label) => {
                            const on = rice[group.id] === label;
                            return (
                              <button
                                key={label}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                className={`rice-option${on ? ' is-on' : ''}`}
                                onClick={() =>
                                  setRice((current) => ({
                                    ...current,
                                    [group.id]: on && group.options.length === 1 ? null : label,
                                  }))
                                }
                              >
                                <span className="rice-dot" />
                                <span>{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                      {extras.length ? (
                        <div className="extra-list">
                          {extras.map((extra) => {
                            const parts = extraParts[extra.id] || 0;
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
                                  parts={parts}
                                  disabled={!extra.available}
                                  onChange={(next) =>
                                    setExtraParts((q) => ({ ...q, [extra.id]: next }))
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      <p className="base-roll-price">
                        {formatTicketCount(price)} tickets la part
                      </p>
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
              : selectedBase
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
            else if (selectedBase) addPlate();
          }}
        >
          {cartHere ? 'Voir le panier' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}
