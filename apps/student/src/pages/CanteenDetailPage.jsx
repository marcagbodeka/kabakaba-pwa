import { useEffect, useMemo, useState } from 'react';
import { catalogApi, vendorsApi } from '../lib/api';
import { useCart } from '../context/CartContext';
import { readView, writeView } from '../lib/instantView';
import { groupPlate } from '../lib/plate';
import { CAPACITY_LABEL, formatTicketCount } from '../lib/format';
import { IconBack, IconPlus } from '../components/icons';

const MAX_PARTS = 12;

function AmountStepper({ parts, min, price, onChange, disabled }) {
  const total = parts * Number(price || 0);
  return (
    <div className="qty-stepper qty-stepper--amount">
      <button
        type="button"
        className="qty-btn"
        disabled={disabled || parts <= min}
        onClick={() => onChange(Math.max(min, parts - 1))}
        aria-label="Moins"
      >
        −
      </button>
      <strong>{parts === 0 ? 'Non' : formatTicketCount(total)}</strong>
      <button
        type="button"
        className="qty-btn"
        disabled={disabled || parts >= MAX_PARTS}
        onClick={() => onChange(Math.min(MAX_PARTS, parts + 1))}
        aria-label="Plus"
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
  const [tab, setTab] = useState(0);
  const [vendor, setVendor] = useState(cached?.vendor || null);
  const [menus, setMenus] = useState(cached?.menus || []);
  const [components, setComponents] = useState(cached?.components || []);
  const [categories, setCategories] = useState(cached?.categories || []);
  const [loading, setLoading] = useState(!cached?.vendor);
  const [baseId, setBaseId] = useState(null);
  const [baseParts, setBaseParts] = useState(1);
  const [extraParts, setExtraParts] = useState({});
  const [choiceId, setChoiceId] = useState(null);

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
  const choices = plate.choice;
  const always = plate.always;
  const openChoices = choices.filter((c) => c.available);
  const openAlways = always.filter((c) => c.available);
  const selectedBase = bases.find((c) => c.id === baseId && c.available) || null;
  const selectedChoice = openChoices.find((c) => c.id === choiceId) || null;

  useEffect(() => {
    const openBases = bases.filter((c) => c.available);
    const open = choices.filter((c) => c.available);
    setBaseId((prev) => (prev && openBases.some((b) => b.id === prev) ? prev : openBases[0]?.id || null));
    setChoiceId((prev) => (prev && open.some((c) => c.id === prev) ? prev : open[0]?.id || null));
  }, [bases, choices]);

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

  const plateTickets = useMemo(() => {
    if (!selectedBase) return 0;
    let total = Number(selectedBase.priceTickets || 0) * baseParts;
    for (const extra of extras) {
      const parts = extraParts[extra.id] || 0;
      if (parts > 0 && extra.available) total += Number(extra.priceTickets || 0) * parts;
    }
    if (selectedChoice) total += Number(selectedChoice.priceTickets || 0);
    for (const item of openAlways) total += Number(item.priceTickets || 0);
    return total;
  }, [selectedBase, baseParts, extras, extraParts, selectedChoice, openAlways]);

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
      });
    };
    push(selectedBase, baseParts);
    for (const extra of extras) {
      if (extra.available) push(extra, extraParts[extra.id] || 0);
    }
    push(selectedChoice, 1);
    for (const item of openAlways) push(item, 1);
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
        <div className="kicker kicker--muted">Cantine du campus</div>
        <div className="meta-chips">
          <span className="meta-chip">{CAPACITY_LABEL[vendor?.capacityStatus] || 'Fermée'}</span>
          {bases.length ? (
            <span className="meta-chip">Plat à composer</span>
          ) : null}
          {menus.length ? (
            <span className="meta-chip">
              {menus.length} menu{menus.length > 1 ? 's' : ''} fixé{menus.length > 1 ? 's' : ''}
            </span>
          ) : null}
        </div>

        <div className="light-tabs">
          {['Mon plat', 'Menus fixés', 'Avis'].map((label, i) => (
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

        {tab === 0 ? (
          bases.length ? (
            <>
              <div className="hint-box">
                Comme au comptoir : d’abord le plat de base, par exemple le riz. Ensuite, poisson, spaghetti ou gari, pour combien tu veux. La sauce ou l’huile, et le piment, viennent avec.
              </div>

              <div className="plate-block">
                <div className="section-title">Nourriture de base</div>
                <p className="plate-help">Obligatoire. Sans elle, la commande ne part pas.</p>
                {bases.map((item) => {
                  const picked = item.id === selectedBase?.id;
                  const price = Number(item.priceTickets || 0);
                  return (
                    <div
                      key={item.id}
                      className={`menu-card${picked ? ' is-picked' : ''}${!item.available ? ' unavailable' : ''}`}
                    >
                      <div className="menu-card-head">
                        <button
                          type="button"
                          className="plate-pick"
                          disabled={!item.available}
                          onClick={() => {
                            setBaseId(item.id);
                            setBaseParts(1);
                          }}
                        >
                          <h3>{item.name}</h3>
                          <p>
                            {item.available
                              ? `${formatTicketCount(price)} tickets la part`
                              : 'Indisponible'}
                          </p>
                        </button>
                        {picked ? (
                          <AmountStepper
                            parts={baseParts}
                            min={1}
                            price={price}
                            onChange={setBaseParts}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {extras.length ? (
                <div className="plate-block">
                  <div className="section-title">En plus, pour combien ?</div>
                  <p className="plate-help">Tu peux rester à zéro.</p>
                  {extras.map((item) => {
                    const parts = extraParts[item.id] || 0;
                    const price = Number(item.priceTickets || 0);
                    return (
                      <div key={item.id} className={`menu-card${!item.available ? ' unavailable' : ''}`}>
                        <div className="menu-card-head">
                          <div>
                            <h3>{item.name}</h3>
                            <p>
                              {item.available
                                ? `${formatTicketCount(price)} tickets la part`
                                : 'Indisponible'}
                            </p>
                          </div>
                          <AmountStepper
                            parts={parts}
                            min={0}
                            price={price}
                            disabled={!item.available}
                            onChange={(next) =>
                              setExtraParts((q) => ({ ...q, [item.id]: next }))
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {openChoices.length || openAlways.length ? (
                <div className="plate-block">
                  <div className="section-title">Servi avec le plat</div>
                  {openChoices.length ? (
                    <>
                      <p className="plate-help">Choisis-en une.</p>
                      {choices.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`menu-card plate-choice${item.id === selectedChoice?.id ? ' is-picked' : ''}${!item.available ? ' unavailable' : ''}`}
                          disabled={!item.available}
                          onClick={() => setChoiceId(item.id)}
                        >
                          <h3>{item.name}</h3>
                          <p>{item.available ? 'Avec le plat' : 'Indisponible'}</p>
                        </button>
                      ))}
                    </>
                  ) : null}
                  {openAlways.length ? (
                    <p className="plate-included">
                      Toujours mis : {openAlways.map((item) => item.name).join(', ')}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="compose-summary">
                <div>
                  <strong>{selectedBase ? selectedBase.name : 'Plat de base'}</strong>
                  <span>{formatTicketCount(plateTickets)} tickets</span>
                </div>
                <button
                  type="button"
                  className="btn-fill"
                  style={{ width: 'auto', padding: '0 16px', height: 40 }}
                  disabled={!selectedBase}
                  onClick={addPlate}
                >
                  Ajouter le plat
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>Pas de plat à composer</h3>
              <p>
                {menus.length
                  ? 'Cette cantine propose des menus fixés. Tu les prends comme ils sont.'
                  : 'La carte n’est pas encore publiée.'}
              </p>
            </div>
          )
        ) : null}

        {tab === 1 ? (
          <>
            <div className="hint-box">
              Ces menus sont fixés. Tu les commandes tels quels, sans rien changer.
            </div>
            {menus.map((menu) => {
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
                    {(menu.lines || []).map((l) => l.name).join(' · ') || 'Menu fixé'}
                  </p>
                  {!menu.available && missing.length ? (
                    <p className="menu-missing">Manque : {missing.join(', ')}</p>
                  ) : null}
                  <div className="menu-card-price">{formatTicketCount(menu.priceTickets)} tickets</div>
                </div>
              );
            })}
            {!menus.length ? (
              <div className="empty-state">
                <h3>Aucun menu fixé</h3>
                <p>Compose ton plat dans l’onglet « Mon plat ».</p>
              </div>
            ) : null}
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
            {cartHere
              ? `${formatTicketCount(cart.subtotal)} tickets`
              : selectedBase && tab === 0
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
            else if (tab === 0 && selectedBase) addPlate();
            else setTab(0);
          }}
        >
          {cartHere ? 'Voir le panier' : selectedBase && tab === 0 ? 'Ajouter' : 'Mon plat'}
        </button>
      </div>
    </div>
  );
}
