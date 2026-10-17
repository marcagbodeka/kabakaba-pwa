import { useEffect, useMemo, useState } from 'react';
import { catalogApi, vendorsApi } from '../lib/api';
import { useCart } from '../context/CartContext';
import { CAPACITY_LABEL, UNIT_LABEL, formatTicketCount } from '../lib/format';
import { IconBack, IconPlus } from '../components/icons';

function componentSections(components, categories) {
  const byKey = new Map();
  for (const c of components) {
    const key = c.categoryId || '__none__';
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(c);
  }
  const sections = [];
  for (const cat of categories) {
    const items = byKey.get(cat.id);
    if (items?.length) sections.push({ title: cat.name, items });
  }
  const loose = byKey.get('__none__');
  if (loose?.length) sections.push({ title: 'Autres', items: loose });
  if (!sections.length && components.length) {
    sections.push({ title: 'Composants', items: components });
  }
  return sections;
}

function acceptsOrders(vendor) {
  const status = String(vendor?.capacityStatus || '').toUpperCase();
  return status === 'OPEN' || status === 'BUSY';
}

export default function CanteenDetailPage({ vendorId, onBack, onOpenCart, showSnack }) {
  const cart = useCart();
  const [tab, setTab] = useState(0);
  const [vendor, setVendor] = useState(null);
  const [menus, setMenus] = useState([]);
  const [components, setComponents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compQty, setCompQty] = useState({});

  useEffect(() => {
    if (!vendorId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [v, m, c, cats] = await Promise.all([
          vendorsApi.get(vendorId),
          catalogApi.menus(vendorId),
          catalogApi.components(vendorId),
          catalogApi.categories(vendorId),
        ]);
        if (cancelled) return;
        setVendor(v);
        setMenus(Array.isArray(m) ? m : []);
        setComponents(Array.isArray(c) ? c : []);
        setCategories(Array.isArray(cats) ? cats : []);
      } catch (e) {
        if (!cancelled) showSnack?.(e.message || 'Impossible de charger la cantine');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId, showSnack]);

  const sections = useMemo(
    () => componentSections(components, categories),
    [components, categories],
  );

  const composeCount = Object.values(compQty).reduce((s, n) => s + (n || 0), 0);
  const composeTotal = components.reduce(
    (s, c) => s + Number(c.priceTickets || 0) * (compQty[c.id] || 0),
    0,
  );

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

  const addMenu = (menu) => {
    if (!guardVendor()) return;
    if (!menu.available) {
      showSnack?.('Ce menu est indisponible');
      return;
    }
    cart.add({
      vendorId,
      vendorName: vendor?.canteenName,
      menuId: menu.id,
      name: menu.name,
      unitPrice: Number(menu.priceTickets ?? 0),
      quantity: 1,
    });
    showSnack?.(`${menu.name} ajouté`, 'success');
  };

  const addComponents = () => {
    if (!guardVendor()) return;
    const selected = components.filter((c) => (compQty[c.id] || 0) > 0 && c.available);
    if (!selected.length) {
      showSnack?.('Choisis au moins un composant');
      return;
    }
    for (const c of selected) {
      cart.add({
        vendorId,
        vendorName: vendor?.canteenName,
        componentId: c.id,
        name: c.name,
        unitPrice: Number(c.priceTickets ?? 0),
        quantity: compQty[c.id],
      });
    }
    setCompQty({});
    showSnack?.('Composition ajoutée au panier', 'success');
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
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Retour">
          <IconBack />
        </button>
        <h1>{vendor?.canteenName || 'Cantine'}</h1>
        <div style={{ width: 40 }} />
      </div>

      <div className="list-pad" style={{ paddingBottom: 100 }}>
        <div className="cover cover--detail">
          {vendor?.bannerUrl || vendor?.logoUrl ? (
            <img src={vendor.bannerUrl || vendor.logoUrl} alt="" />
          ) : (
            <div className="cover-fallback" />
          )}
          <div className="cover-shade" />
          <div className="cover-meta">
            <span className={`status-pill ${String(vendor?.capacityStatus || 'CLOSED').toLowerCase()}`}>
              {CAPACITY_LABEL[vendor?.capacityStatus] || 'Fermée'}
            </span>
            <h2>{vendor?.canteenName}</h2>
            {vendor?.description ? <p>{vendor.description}</p> : null}
          </div>
        </div>

        <div className="kicker kicker--muted">Cantine du campus</div>
        <div className="meta-chips">
          <span className="meta-chip">{CAPACITY_LABEL[vendor?.capacityStatus] || 'Fermée'}</span>
          <span className="meta-chip">
            {menus.length} menu{menus.length > 1 ? 's' : ''}
          </span>
          <span className="meta-chip">
            {components.length} composant{components.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="light-tabs">
          {['Menus', 'Composer', 'Avis'].map((label, i) => (
            <button
              key={label}
              type="button"
              className={`light-tab${tab === i ? ' active' : ''}`}
              onClick={() => setTab(i)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 0
          ? menus.map((menu) => {
              const missing = (menu.missingComponents || []).map((m) => m.name).filter(Boolean);
              return (
                <div key={menu.id} className={`menu-card${!menu.available ? ' unavailable' : ''}`}>
                  <div className="menu-card-head">
                    <div>
                      <h3>{menu.name}</h3>
                      <span className={`status-pill tiny ${menu.available ? 'open' : 'closed'}`}>
                        {menu.available ? 'Disponible' : 'Indisponible'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="qty-btn qty-btn--accent"
                      disabled={!menu.available}
                      onClick={() => addMenu(menu)}
                      aria-label="Ajouter"
                    >
                      <IconPlus />
                    </button>
                  </div>
                  <p>
                    {(menu.lines || []).map((l) => l.name).join(' · ') || 'Menu pré-composé'}
                  </p>
                  {!menu.available && missing.length ? (
                    <p className="menu-missing">Manque : {missing.join(', ')}</p>
                  ) : null}
                  <div className="menu-card-price">{formatTicketCount(menu.priceTickets)} tickets</div>
                </div>
              );
            })
          : null}

        {tab === 0 && !menus.length ? (
          <div className="empty-state">
            <h3>Menu encore vide</h3>
            <p>Compose ton repas avec les composants disponibles.</p>
          </div>
        ) : null}

        {tab === 1 ? (
          <>
            <div className="hint-box">
              Compose ton repas en choisissant les composants à la carte, puis ajoute-les au panier.
            </div>
            {sections.map((section) => (
              <div key={section.title} style={{ marginBottom: 16 }}>
                <div className="section-row" style={{ marginBottom: 8 }}>
                  <div className="section-title" style={{ marginBottom: 0, fontSize: 15 }}>
                    {section.title}
                  </div>
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    {section.items.length} option{section.items.length > 1 ? 's' : ''}
                  </span>
                </div>
                {section.items.map((c) => (
                  <div key={c.id} className={`menu-card${!c.available ? ' unavailable' : ''}`}>
                    <div className="menu-card-head">
                      <div>
                        <h3>{c.name}</h3>
                        <p style={{ marginTop: 4 }}>
                          {c.available
                            ? `${formatTicketCount(c.priceTickets)} tickets · ${UNIT_LABEL[c.unit] || c.unit}`
                            : 'Indisponible'}
                        </p>
                      </div>
                      <div className="qty-stepper">
                        <button
                          type="button"
                          className="qty-btn"
                          disabled={!c.available || !(compQty[c.id] > 0)}
                          onClick={() =>
                            setCompQty((q) => ({
                              ...q,
                              [c.id]: Math.max(0, (q[c.id] || 0) - 1),
                            }))
                          }
                        >
                          −
                        </button>
                        <strong>{compQty[c.id] || 0}</strong>
                        <button
                          type="button"
                          className="qty-btn"
                          disabled={!c.available}
                          onClick={() =>
                            setCompQty((q) => ({
                              ...q,
                              [c.id]: Math.min(50, (q[c.id] || 0) + 1),
                            }))
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {!components.length ? (
              <div className="empty-state">
                <h3>Rien à composer</h3>
                <p>Cette cantine n’a pas encore publié son stock.</p>
              </div>
            ) : (
              <div className="compose-summary">
                <div>
                  <strong>
                    {composeCount} article{composeCount > 1 ? 's' : ''}
                  </strong>
                  <span>{formatTicketCount(composeTotal)} tickets</span>
                </div>
                <button
                  type="button"
                  className="btn-fill"
                  style={{ width: 'auto', padding: '0 16px', height: 40 }}
                  disabled={!composeCount}
                  onClick={addComponents}
                >
                  Ajouter au panier
                </button>
              </div>
            )}
          </>
        ) : null}

        {tab === 2 ? (
          <div className="empty-state">
            <div className="hint-box" style={{ marginBottom: 16, textAlign: 'left' }}>
              Les avis restent internes : ils aident kabakaba et le vendeur, ils ne sont pas affichés
              aux autres étudiants.
            </div>
            <h3>Pas encore d’avis</h3>
            <p>Tu pourras noter cette cantine dès que ta commande sera prête.</p>
          </div>
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
          {cartHere ? <span className="sticky-badge">{cart.itemCount > 9 ? '9+' : cart.itemCount}</span> : null}
        </div>
        <div className="meta">
          <strong>Total</strong>
          <span>
            {cartHere ? `${formatTicketCount(cart.subtotal)} tickets` : 'Choisis ton repas'}
          </span>
        </div>
        <button
          type="button"
          className="btn-fill"
          style={{ width: 'auto', padding: '0 16px', height: 42 }}
          onClick={() => {
            if (cartHere) onOpenCart();
            else setTab(1);
          }}
        >
          {cartHere ? 'Voir le panier' : 'Composer'}
        </button>
      </div>
    </div>
  );
}
