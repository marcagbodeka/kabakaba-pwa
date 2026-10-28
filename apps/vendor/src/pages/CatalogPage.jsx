import { useCallback, useEffect, useMemo, useState } from 'react';
import SubpageBar from '../components/SubpageBar';
import { useConfirm } from '../components/ConfirmDialog';
import { IconPlus } from '../components/icons';
import {
  categoriesApi,
  componentsApi,
  menusApi,
  takeawayApi,
} from '../lib/api';
import { formatTickets } from '../lib/format';
import { readView, writeView } from '../lib/instantView';
import { PLATE, isIncludedRole, roleOfComponent } from '../lib/plate';

const SELL_KINDS = [
  { id: 'base', title: 'Plat de base', example: 'Riz, attiéké, pâtes' },
  { id: 'extra', title: 'En plus', example: 'Poisson, spaghetti, gari' },
  { id: 'with', title: 'Avec le plat', example: 'Sauce, huile, piment' },
  { id: 'drink', title: 'Boisson', example: 'Bissap, jus, eau' },
];

const SECTION_HINT = {
  base: 'Sans ce plat, l’étudiant ne commande pas.',
  extra: 'Il peut en prendre, ou pas.',
  with: 'C’est compris dans le plat. Pas de prix à part.',
  drink: 'À part du plat.',
  menus: 'Un plat déjà composé. L’étudiant le prend tel quel.',
  takeaway: 'Seulement s’il n’est pas sur place.',
};

function includedKind(kind) {
  return kind === 'choice' || kind === 'always';
}

function FoodSheet({ initial, role, onClose, onSave, onDelete, onSwitch, busy }) {
  const preset = role === 'with' || role === 'choice' ? 'choice' : role === 'always' ? 'always' : role;
  const [picking, setPicking] = useState(!initial && !preset);
  const [kind, setKind] = useState(preset || 'base');
  const [name, setName] = useState(initial?.name || '');
  const [localName, setLocalName] = useState(initial?.localName || '');
  const [priceTickets, setPrice] = useState(
    initial ? String(initial.priceTickets ?? '') : '',
  );
  const [isAvailable, setAvail] = useState(initial?.isAvailable !== false);
  const included = includedKind(kind);
  const kindMeta = SELL_KINDS.find((item) => item.id === (included ? 'with' : kind));

  const choose = (next) => {
    setKind(next === 'with' ? 'choice' : next);
    setPicking(false);
    if (next === 'with') setPrice('0');
  };

  const originalKind = preset;
  const soldAlone =
    initial && kind === originalKind
      ? Boolean(initial.soldAlone)
      : kind === 'base' || kind === 'drink';

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--tall sell-sheet" onClick={(e) => e.stopPropagation()}>
        {picking ? (
          <>
            <h2>Qu’est-ce que tu vends ?</h2>
            <div className="sell-picks">
              {SELL_KINDS.map((item) => (
                <button key={item.id} type="button" className="sell-pick" onClick={() => choose(item.id)}>
                  <strong>{item.title}</strong>
                  <span>{item.example}</span>
                </button>
              ))}
              <button type="button" className="sell-quiet" onClick={() => onSwitch('menus')}>
                Un menu déjà composé
              </button>
              <button type="button" className="sell-quiet" onClick={() => onSwitch('takeaway')}>
                À emporter, par exemple une barquette
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{initial ? 'Modifier' : kindMeta?.title || 'Ajouter'}</h2>
            {!initial && !role ? (
              <button type="button" className="sell-quiet sell-quiet--back" onClick={() => setPicking(true)}>
                Changer
              </button>
            ) : null}
            <input
              className="sell-name"
              value={name}
              autoFocus
              placeholder={included ? 'Sauce tomate' : kindMeta?.example?.split(',')[0] || 'Le nom'}
              onChange={(e) => setName(e.target.value)}
            />
            {included ? (
              <>
                <div className="sell-pair">
                  <button
                    type="button"
                    className={`sell-pick${kind === 'choice' ? ' on' : ''}`}
                    onClick={() => setKind('choice')}
                  >
                    <strong>Il choisit</strong>
                    <span>Sauce ou huile</span>
                  </button>
                  <button
                    type="button"
                    className={`sell-pick${kind === 'always' ? ' on' : ''}`}
                    onClick={() => setKind('always')}
                  >
                    <strong>Toujours dessus</strong>
                    <span>Piment, par exemple</span>
                  </button>
                </div>
                <input
                  className="sell-name sell-name--quiet"
                  value={localName}
                  placeholder="Autre nom, par exemple Nougbagba"
                  onChange={(e) => setLocalName(e.target.value)}
                />
              </>
            ) : (
              <label className="sell-price">
                <span>Prix en tickets</span>
                <input
                  inputMode="numeric"
                  value={priceTickets}
                  placeholder="250"
                  onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
                />
              </label>
            )}
            {initial ? (
              <label className="sell-today">
                <span>Je le vends aujourd’hui</span>
                <input
                  className="setting-switch"
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setAvail(e.target.checked)}
                />
              </label>
            ) : null}
            <button
              type="button"
              className="btn-action fill primary full"
              disabled={busy || !name.trim() || (!included && priceTickets === '')}
              onClick={() =>
                onSave({
                  kind,
                  name: name.trim(),
                  localName: included ? localName.trim() || null : null,
                  unit: 'PORTION',
                  priceTickets: included ? 0 : Number(priceTickets),
                  isAvailable,
                  soldAlone,
                  lowStockThreshold: initial?.lowStockThreshold ?? 5,
                  ...(initial ? {} : { quantity: included ? 80 : 40 }),
                })
              }
            >
              {busy ? 'Enregistrement…' : 'C’est bon'}
            </button>
            {initial && onDelete ? (
              <button
                type="button"
                className="sell-quiet sell-quiet--danger"
                disabled={busy}
                onClick={() => onDelete(initial)}
              >
                Retirer de la carte
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function MenuSheet({ components, categories, initial, onClose, onSave, onDelete, busy }) {
  const [name, setName] = useState(initial?.name || '');
  const [isActive, setActive] = useState(initial?.isActive !== false);
  const [selected, setSelected] = useState(() => {
    const map = {};
    (initial?.lines || []).forEach((l) => {
      map[l.componentId] = Math.max(1, Number(l.quantity) || 1);
    });
    return map;
  });

  const toggle = (id) => {
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  };

  const bump = (id, delta) => {
    setSelected((s) => ({
      ...s,
      [id]: Math.max(1, (Number(s[id]) || 1) + delta),
    }));
  };

  const lines = Object.entries(selected).map(([componentId, quantity]) => ({
    componentId,
    quantity: Math.max(1, Number(quantity) || 1),
  }));

  const roleTag = {
    base: 'Base',
    extra: 'En plus',
    choice: 'Avec',
    always: 'Avec',
    other: 'À ranger',
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--tall" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Modifier le menu' : 'Menu déjà composé'}</h2>
        <p className="sub">Donne-lui un nom, puis touche ce qu’il contient.</p>
        <input
          className="sell-name"
          value={name}
          autoFocus
          placeholder="Riz poisson"
          onChange={(e) => setName(e.target.value)}
        />
        <div className="kicker-inline">Dedans</div>
        <div className="pick-list">
          {components.map((c) => {
            const on = selected[c.id] != null;
            const role = roleOfComponent(c, categories);
            return (
              <div key={c.id} className={`pick-row${on ? ' on' : ''}`}>
                <button type="button" className="pick-main" onClick={() => toggle(c.id)}>
                  <strong>{c.name}</strong>
                  <span>
                    {roleTag[role]} · {formatTickets(c.priceTickets)}
                  </span>
                </button>
                {on ? (
                  <span className="pick-step">
                    <button type="button" aria-label="Moins" onClick={() => bump(c.id, -1)}>
                      −
                    </button>
                    {selected[c.id]}
                    <button type="button" aria-label="Plus" onClick={() => bump(c.id, 1)}>
                      +
                    </button>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        {initial ? (
          <label className="sell-today">
            <span>Je le propose</span>
            <input
              className="setting-switch"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setActive(e.target.checked)}
            />
          </label>
        ) : null}
        <button
          type="button"
          className="btn-action fill primary full"
          disabled={busy || !name.trim() || lines.length === 0}
          onClick={() =>
            onSave({
              name: name.trim(),
              description: initial?.description?.trim() || undefined,
              isActive,
              lines,
            })
          }
        >
          {busy ? 'Enregistrement…' : 'C’est bon'}
        </button>
        {initial && onDelete ? (
          <button type="button" className="sell-quiet sell-quiet--danger" disabled={busy} onClick={() => onDelete(initial)}>
            Retirer ce menu
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TakeawaySheet({ initial, onClose, onSave, onDelete, busy }) {
  const [name, setName] = useState(initial?.name || '');
  const [priceTickets, setPrice] = useState(String(initial?.priceTickets ?? '0'));
  const [isActive, setActive] = useState(initial?.isActive !== false);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Modifier' : 'À emporter'}</h2>
        <input
          className="sell-name"
          value={name}
          autoFocus
          placeholder="Barquette"
          onChange={(e) => setName(e.target.value)}
        />
        <label className="sell-price">
          <span>Prix en tickets</span>
          <input
            inputMode="numeric"
            value={priceTickets}
            placeholder="0"
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        {initial ? (
          <label className="sell-today">
            <span>Je le propose</span>
            <input
              className="setting-switch"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setActive(e.target.checked)}
            />
          </label>
        ) : null}
        <button
          type="button"
          className="btn-action fill primary full"
          disabled={busy || !name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              priceTickets: Number(priceTickets || 0),
              isActive,
            })
          }
        >
          {busy ? 'Enregistrement…' : 'C’est bon'}
        </button>
        {initial && onDelete ? (
          <button type="button" className="sell-quiet sell-quiet--danger" disabled={busy} onClick={() => onDelete(initial)}>
            Retirer
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StockButtons({ item, onAdjust, onEdit }) {
  return (
    <div className="catalog-actions">
      <button type="button" className="qty-btn" onClick={() => onAdjust(item, -1)} aria-label="Retirer une part">
        −
      </button>
      <span className="stock-count">{item.quantity}</span>
      <button type="button" className="qty-btn" onClick={() => onAdjust(item, 1)} aria-label="Ajouter une part">
        +
      </button>
      <button type="button" className="link-mini" onClick={() => onEdit(item)}>
        Modifier
      </button>
    </div>
  );
}

export default function CatalogPage({ vendor, onBack, showSnack }) {
  const confirm = useConfirm();
  const vendorId = vendor?.id;
  const cachedCatalog = readView('catalog');
  const asList = (value) => (Array.isArray(value) ? value : []);
  const [components, setComponents] = useState(() => asList(cachedCatalog?.components));
  const [categories, setCategories] = useState(() => asList(cachedCatalog?.categories));
  const [menus, setMenus] = useState(() => asList(cachedCatalog?.menus));
  const [options, setOptions] = useState(() => asList(cachedCatalog?.options));
  const [loading, setLoading] = useState(!cachedCatalog);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    if (!vendorId) {
      setLoading(false);
      setLoadError('Profil cantine introuvable. Reviens en arrière puis rouvre Ma carte.');
      return;
    }
    if (!readView('catalog')) setLoading(true);
    const settled = await Promise.allSettled([
      componentsApi.manage(vendorId),
      categoriesApi.list(vendorId),
      menusApi.manage(vendorId),
      takeawayApi.manage(vendorId),
    ]);
    const [c, cats, m, t] = settled;
    const failed = settled.filter((result) => result.status === 'rejected');
    if (c.status === 'fulfilled') setComponents(Array.isArray(c.value) ? c.value : []);
    if (cats.status === 'fulfilled') setCategories(Array.isArray(cats.value) ? cats.value : []);
    if (m.status === 'fulfilled') setMenus(Array.isArray(m.value) ? m.value : []);
    if (t.status === 'fulfilled') setOptions(Array.isArray(t.value) ? t.value : []);
    if (!failed.length) {
      setLoadError('');
      writeView('catalog', {
        components: c.status === 'fulfilled' && Array.isArray(c.value) ? c.value : [],
        categories: cats.status === 'fulfilled' && Array.isArray(cats.value) ? cats.value : [],
        menus: m.status === 'fulfilled' && Array.isArray(m.value) ? m.value : [],
        options: t.status === 'fulfilled' && Array.isArray(t.value) ? t.value : [],
      });
    } else if (readView('catalog')) {
      setLoadError('');
    } else if (c.status === 'rejected' && cats.status === 'rejected') {
      const reason = c.reason?.message || cats.reason?.message || 'Carte indisponible';
      setLoadError(reason);
      showSnack(reason);
    } else {
      const reason = failed[0].reason?.message || 'Une partie de la carte n’a pas pu être chargée';
      setLoadError(reason);
    }
    setLoading(false);
  }, [vendorId, showSnack]);

  const grouped = useMemo(() => {
    const groups = { base: [], extra: [], choice: [], always: [], drink: [], other: [] };
    const rows = Array.isArray(components) ? components : [];
    const cats = Array.isArray(categories) ? categories : [];
    for (const component of rows) {
      if (!component) continue;
      const role = roleOfComponent(component, cats);
      (groups[role] || groups.other).push(component);
    }
    return groups;
  }, [components, categories]);

  useEffect(() => {
    reload();
  }, [reload]);

  const categoryIdFor = async (name) => {
    const found = categories.find((c) => c.name === name);
    if (found) return found.id;
    const created = await categoriesApi.create({ name });
    setCategories((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
    return created.id;
  };

  const saveFood = async (body) => {
    const categoryName = {
      base: PLATE.base,
      extra: PLATE.extra,
      choice: PLATE.choice,
      always: PLATE.always,
      drink: PLATE.drink,
    }[body.kind];
    setBusy(true);
    try {
      const categoryId = await categoryIdFor(categoryName);
      const payload = {
        name: body.name,
        localName: body.localName,
        unit: 'PORTION',
        priceTickets: body.priceTickets,
        isAvailable: body.isAvailable,
        soldAlone: Boolean(body.soldAlone),
        categoryId,
        lowStockThreshold: body.lowStockThreshold ?? 5,
        ...(sheet?.item ? {} : { quantity: body.quantity }),
      };
      if (sheet?.item) await componentsApi.update(sheet.item.id, payload);
      else await componentsApi.create(payload);
      setSheet(null);
      await reload();
      showSnack('Enregistré');
    } catch (e) {
      showSnack(e.message || 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const classify = async (item, kind) => {
    setBusy(true);
    try {
      const categoryName = {
        base: PLATE.base,
        extra: PLATE.extra,
        choice: PLATE.choice,
        always: PLATE.always,
        drink: PLATE.drink,
      }[kind];
      const categoryId = await categoryIdFor(categoryName);
      await componentsApi.update(item.id, {
        categoryId,
        priceTickets: isIncludedRole(kind) ? 0 : Number(item.priceTickets || 0),
        soldAlone: kind === 'base' || kind === 'drink',
      });
      await reload();
      showSnack(`${item.name} rangé`);
    } catch (e) {
      showSnack(e.message || 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const adjust = async (item, delta) => {
    try {
      await componentsApi.adjustStock(item.id, delta);
      await reload();
    } catch (e) {
      showSnack(e.message);
    }
  };

  const saveMenu = async (body) => {
    setBusy(true);
    try {
      if (sheet?.item) await menusApi.update(sheet.item.id, body);
      else await menusApi.create(body);
      setSheet(null);
      await reload();
      showSnack('Menu enregistré');
    } catch (e) {
      showSnack(e.message || 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const saveTakeaway = async (body) => {
    setBusy(true);
    try {
      if (sheet?.item) await takeawayApi.update(sheet.item.id, body);
      else await takeawayApi.create(body);
      setSheet(null);
      await reload();
      showSnack('Option enregistrée');
    } catch (e) {
      showSnack(e.message || 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const removeComponent = async (item) => {
    const ok = await confirm({
      title: 'Retirer de la carte',
      message: `« ${item.name} » ne sera plus proposé aux étudiants.`,
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await componentsApi.remove(item.id);
      setSheet(null);
      await reload();
      showSnack('Retiré');
    } catch (e) {
      showSnack(e.message || 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  };

  const removeMenu = async (item) => {
    const ok = await confirm({
      title: 'Retirer le menu',
      message: `Le menu « ${item.name} » disparaîtra de la carte.`,
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await menusApi.remove(item.id);
      setSheet(null);
      await reload();
      showSnack('Menu retiré');
    } catch (e) {
      showSnack(e.message || 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  };

  const removeTakeaway = async (item) => {
    const ok = await confirm({
      title: 'Retirer l’option',
      message: `« ${item.name} » ne sera plus proposée à emporter.`,
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await takeawayApi.remove(item.id);
      setSheet(null);
      await reload();
      showSnack('Option retirée');
    } catch (e) {
      showSnack(e.message || 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  };

  const openCreate = (role) => {
    if (role === 'menus') setSheet({ type: 'menus', item: null });
    else if (role === 'takeaway') setSheet({ type: 'takeaway', item: null });
    else setSheet({ type: 'food', role: role || null, item: null });
  };

  const foodOf = (role) => grouped[role] || [];

  const renderFood = (item) => {
    const available = item.isAvailable !== false && Number(item.quantity) > 0;
    const role = roleOfComponent(item, categories);
    const included = isIncludedRole(role);
    return (
      <div key={item.id} className={`catalog-card${!available ? ' dim' : ''}`}>
        <div className="catalog-main">
          <strong>{item.localName ? `${item.name} · ${item.localName}` : item.name}</strong>
          <span>
            {included ? 'Avec le plat' : formatTickets(item.priceTickets)}
            {item.isAvailable === false ? ' · pas aujourd’hui' : available ? '' : ' · fini'}
          </span>
        </div>
        <StockButtons
          item={item}
          onAdjust={adjust}
          onEdit={(food) => setSheet({ type: 'food', role, item: food })}
        />
      </div>
    );
  };

  const emptyCatalog =
    !components.length && !menus.length && !options.length && !grouped.other.length;

  const Section = ({ title, hint, action, onAdd, children, count }) => (
    <section className="catalog-section">
      <div className="catalog-section-head">
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      {count ? children : null}
      <button type="button" className="catalog-add" onClick={onAdd}>
        <IconPlus />
        {action}
      </button>
    </section>
  );

  return (
    <div className="dashboard-body">
      <SubpageBar
        title="Ma carte"
        eyebrow="Cantine"
        onBack={onBack}
        action={
          <button type="button" className="circle-action" onClick={() => openCreate(null)} aria-label="Ajouter">
            <IconPlus />
          </button>
        }
      />

      <div className="sheet-body sheet-body--sub">
      <div className="catalog-scroll">

      {loadError ? (
        <div className="catalog-error">
          <strong>La carte n’a pas pu être chargée</strong>
          <p>{loadError}</p>
          <button type="button" className="btn-action outline" onClick={reload}>
            Réessayer
          </button>
        </div>
      ) : null}

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="catalog-list">
          {emptyCatalog ? (
            <div className="sell-home">
              <h2>Qu’est-ce que tu vends ?</h2>
              <p>Choisis, écris le nom, puis le prix.</p>
              <div className="sell-picks">
                {SELL_KINDS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="sell-pick"
                    onClick={() => openCreate(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.example}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {grouped.other.length ? (
            <section className="catalog-section">
              <div className="catalog-section-head">
                <h2>À ranger</h2>
                <p>Touche l’endroit où cet article doit aller.</p>
              </div>
              {grouped.other.map((item) => (
                <div key={item.id} className="catalog-card catalog-card--classify">
                  <div className="catalog-main">
                    <strong>{item.name}</strong>
                    <span>{formatTickets(item.priceTickets)}</span>
                  </div>
                  <div className="classify-actions">
                    <button type="button" onClick={() => classify(item, 'base')}>Plat de base</button>
                    <button type="button" onClick={() => classify(item, 'extra')}>En plus</button>
                    <button type="button" onClick={() => classify(item, 'choice')}>Il choisit</button>
                    <button type="button" onClick={() => classify(item, 'always')}>Toujours dessus</button>
                    <button type="button" onClick={() => classify(item, 'drink')}>Boisson</button>
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {!emptyCatalog ? (
          <>
          <Section
            title="Plat de base"
            hint={SECTION_HINT.base}
            action="Ajouter un plat"
            count={foodOf('base').length}
            onAdd={() => openCreate('base')}
          >
            {foodOf('base').map(renderFood)}
          </Section>
          <Section
            title="En plus"
            hint={SECTION_HINT.extra}
            action="Ajouter"
            count={foodOf('extra').length}
            onAdd={() => openCreate('extra')}
          >
            {foodOf('extra').map(renderFood)}
          </Section>
          <Section
            title="Avec le plat"
            hint={SECTION_HINT.with}
            action="Ajouter une sauce, une huile…"
            count={foodOf('choice').length + foodOf('always').length}
            onAdd={() => openCreate('with')}
          >
            {foodOf('choice').map(renderFood)}
            {foodOf('always').map(renderFood)}
          </Section>
          <Section
            title="Boissons"
            hint={SECTION_HINT.drink}
            action="Ajouter une boisson"
            count={foodOf('drink').length}
            onAdd={() => openCreate('drink')}
          >
            {foodOf('drink').map(renderFood)}
          </Section>
          <Section
            title="Menus"
            hint={SECTION_HINT.menus}
            action="Ajouter un menu"
            count={menus.length}
            onAdd={() => openCreate('menus')}
          >
            {menus.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`catalog-card${!m.isActive ? ' dim' : ''}`}
                onClick={() => setSheet({ type: 'menus', item: m })}
              >
                <div className="catalog-main">
                  <strong>{m.name}</strong>
                  <span>
                    {(m.lines || []).map((l) => l.name || l.component?.name).filter(Boolean).join(' · ') ||
                      'Rien dedans'}
                    {!m.isActive ? ' · pas aujourd’hui' : ''}
                  </span>
                </div>
              </button>
            ))}
          </Section>
          <Section
            title="À emporter"
            hint={SECTION_HINT.takeaway}
            action="Ajouter"
            count={options.length}
            onAdd={() => openCreate('takeaway')}
          >
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`catalog-card${!o.isActive ? ' dim' : ''}`}
                onClick={() => setSheet({ type: 'takeaway', item: o })}
              >
                <div className="catalog-main">
                  <strong>{o.name}</strong>
                  <span>
                    {formatTickets(o.priceTickets)}
                    {!o.isActive ? ' · pas aujourd’hui' : ''}
                  </span>
                </div>
              </button>
            ))}
          </Section>
          </>
          ) : null}
        </div>
      )}
      </div>
      </div>

      {sheet?.type === 'food' ? (
        <FoodSheet
          initial={sheet.item}
          role={sheet.role}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={saveFood}
          onSwitch={(type) => setSheet({ type, item: null })}
          onDelete={removeComponent}
        />
      ) : null}
      {sheet?.type === 'menus' ? (
        <MenuSheet
          components={components}
          categories={categories}
          initial={sheet.item}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={saveMenu}
          onDelete={removeMenu}
        />
      ) : null}
      {sheet?.type === 'takeaway' ? (
        <TakeawaySheet
          initial={sheet.item}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={saveTakeaway}
          onDelete={removeTakeaway}
        />
      ) : null}
    </div>
  );
}
