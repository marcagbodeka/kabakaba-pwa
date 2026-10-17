import { useEffect, useState } from 'react';
import { catalogApi, vendorsApi } from '../lib/api';
import { useCart } from '../context/CartContext';
import {
  CAPACITY_LABEL,
  UNIT_LABEL,
  formatTickets,
  initialsFrom,
} from '../lib/format';
import { IconBack, IconPlus } from '../components/icons';

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
    if (!vendorId) return;
    (async () => {
      setLoading(true);
      try {
        const [v, m, c, cats] = await Promise.all([
          vendorsApi.get(vendorId),
          catalogApi.menus(vendorId),
          catalogApi.components(vendorId),
          catalogApi.categories(vendorId),
        ]);
        setVendor(v);
        setMenus(Array.isArray(m) ? m : []);
        setComponents(Array.isArray(c) ? c : []);
        setCategories(Array.isArray(cats) ? cats : []);
      } catch (e) {
        showSnack(e.message || 'Impossible de charger la cantine');
      } finally {
        setLoading(false);
      }
    })();
  }, [vendorId, showSnack]);

  const addMenu = (menu) => {
    if (!menu.available) {
      showSnack('Ce menu est indisponible');
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
    showSnack('Ajouté au panier');
  };

  const addComponents = () => {
    const selected = components.filter((c) => (compQty[c.id] || 0) > 0);
    if (!selected.length) {
      showSnack('Choisis au moins un composant');
      return;
    }
    for (const c of selected) {
      if (!c.available) continue;
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
    showSnack('Composition ajoutée au panier');
  };

  if (loading) {
    return (
      <div className="page page--flush" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page page--flush">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Retour">
          <IconBack />
        </button>
        <h1>{vendor?.canteenName || 'Cantine'}</h1>
        <div style={{ width: 40 }} />
      </div>

      <div className="cover">
        {vendor?.bannerUrl || vendor?.logoUrl ? (
          <img src={vendor.bannerUrl || vendor.logoUrl} alt="" />
        ) : null}
        <div className="cover-meta">
          <h2>{vendor?.canteenName}</h2>
          <span className={`pill ${String(vendor?.capacityStatus || 'CLOSED').toLowerCase()}`}>
            {CAPACITY_LABEL[vendor?.capacityStatus] || 'Fermée'}
          </span>
        </div>
      </div>

      <div className="tabs">
        {['Menus', 'Composer'].map((label, i) => (
          <button
            key={label}
            type="button"
            className={`tab${tab === i ? ' active' : ''}`}
            onClick={() => setTab(i)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="list-pad">
        {tab === 0
          ? menus.map((menu) => (
              <div
                key={menu.id}
                className={`item-card${!menu.available ? ' unavailable' : ''}`}
              >
                <div style={{ flex: 1 }}>
                  <h3>{menu.name}</h3>
                  <p>
                    {menu.available
                      ? (menu.lines || []).map((l) => l.name).join(' · ') || 'Menu pré-composé'
                      : `Indisponible${
                          menu.missingComponents?.length
                            ? ` : ${menu.missingComponents.map((m) => m.name).join(', ')}`
                            : ''
                        }`}
                  </p>
                </div>
                <div className="price">{formatTickets(menu.priceTickets)}</div>
                <button
                  type="button"
                  className="qty-btn"
                  disabled={!menu.available}
                  onClick={() => addMenu(menu)}
                  aria-label="Ajouter"
                >
                  <IconPlus />
                </button>
              </div>
            ))
          : null}

        {tab === 1 ? (
          <>
            {(categories.length
              ? [
                  ...categories.map((cat) => ({
                    id: cat.id,
                    name: cat.name,
                    items: components.filter((c) => c.categoryId === cat.id),
                  })),
                  {
                    id: 'other',
                    name: 'Autres',
                    items: components.filter(
                      (c) => !categories.some((cat) => cat.id === c.categoryId),
                    ),
                  },
                ].filter((group) => group.items.length)
              : [{ id: 'all', name: '', items: components }]
            ).map((group) => (
              <div key={group.id}>
                {group.name ? (
                  <div className="kicker" style={{ marginTop: 8 }}>
                    {group.name}
                  </div>
                ) : null}
                {group.items.map((c) => (
              <div
                key={c.id}
                className={`item-card${!c.available ? ' unavailable' : ''}`}
              >
                <div style={{ flex: 1 }}>
                  <h3>{c.name}</h3>
                  <p>
                    {c.available ? 'Disponible' : 'Indisponible'} ·{' '}
                    {UNIT_LABEL[c.unit] || c.unit}
                  </p>
                </div>
                <div className="price">{formatTickets(c.priceTickets)}</div>
                <button
                  type="button"
                  className="qty-btn"
                  disabled={!c.available || (compQty[c.id] || 0) <= 0}
                  onClick={() =>
                    setCompQty((q) => ({
                      ...q,
                      [c.id]: Math.max(0, (q[c.id] || 0) - 1),
                    }))
                  }
                >
                  −
                </button>
                <strong style={{ minWidth: 18, textAlign: 'center' }}>
                  {compQty[c.id] || 0}
                </strong>
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
                ))}
              </div>
            ))}
            {!components.length ? (
              <div className="empty">
                <h3>Aucun composant</h3>
                <p>Cette cantine n’a pas encore publié son stock.</p>
              </div>
            ) : null}
          </>
        ) : null}

        {tab === 0 && !menus.length ? (
          <div className="empty">
            <h3>Aucun menu</h3>
            <p>Compose ton repas avec les composants disponibles.</p>
          </div>
        ) : null}
      </div>

      <div className="sticky-bar">
        <div className="meta">
          <strong>
            {cart.vendorId === vendorId
              ? `${cart.itemCount} article${cart.itemCount > 1 ? 's' : ''}`
              : initialsFrom(vendor?.canteenName)}
          </strong>
          <span>
            {cart.vendorId === vendorId
              ? formatTickets(cart.subtotal)
              : 'Ajoute des articles'}
          </span>
        </div>
        {tab === 1 ? (
          <button type="button" className="btn-fill" style={{ width: 'auto', padding: '0 18px' }} onClick={addComponents}>
            Ajouter
          </button>
        ) : (
          <button
            type="button"
            className="btn-fill"
            style={{ width: 'auto', padding: '0 18px' }}
            disabled={cart.itemCount === 0}
            onClick={onOpenCart}
          >
            Panier
          </button>
        )}
      </div>
    </div>
  );
}
