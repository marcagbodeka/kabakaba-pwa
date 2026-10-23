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

const ROLE_COPY = {
  base: {
    label: 'Base',
    title: 'Plat de base',
    lead: 'Ce que l’étudiant annonce en premier. Exemple : riz 250. Sans ce plat, il ne peut pas commander.',
    empty: 'Ajoute le riz, ou un autre plat sans lequel tu ne sers pas.',
    name: 'Riz',
    price: 'C’est le montant d’une part. Riz à 250 : l’étudiant dit « riz 250 ». Deux parts font 500.',
  },
  extra: {
    label: 'En plus',
    title: 'En plus',
    lead: 'Ce que tu demandes ensuite : « du poisson pour combien ? du spaghetti ? du gari ? ». Il peut répondre zéro.',
    empty: 'Ajoute le poisson, le spaghetti, le gari…',
    name: 'Poisson',
    price: 'Prix d’une part. L’étudiant choisit pour combien : 0, une part, deux parts.',
  },
  with: {
    label: 'Avec',
    title: 'Servi avec le plat',
    lead: 'Ce que tu poses avec le plat de base. La sauce ou l’huile : il en choisit une. Le piment : tu le mets toujours.',
    empty: 'Ajoute la sauce, l’huile, le piment.',
    name: 'Sauce',
    price: '',
  },
  menus: {
    label: 'Menus',
    title: 'Menus fixés',
    lead: 'Un menu fixé se commande tel quel. L’étudiant ne retire rien et n’ajoute rien.',
    empty: 'Crée un plat déjà composé, avec son prix fermé.',
  },
  takeaway: {
    label: 'Emporté',
    title: 'À emporter',
    lead: 'Un supplément seulement quand l’étudiant ne mange pas sur place. Exemple : la barquette.',
    empty: 'Sans option ici, les étudiants commandent uniquement sur place.',
  },
  sort: {
    label: 'À ranger',
    title: 'À ranger',
    lead: 'Ces articles ne sont pas encore dans la carte. Range-les pour que les étudiants les voient au bon endroit.',
    empty: '',
  },
};

function Field({ label, hint, children }) {
  return (
    <div className="vfield">
      <label>{label}</label>
      {children}
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

function FoodSheet({ initial, role, onClose, onSave, onDelete, busy }) {
  const [kind, setKind] = useState(role === 'extra' ? 'extra' : role === 'with' ? 'choice' : role === 'always' ? 'always' : role === 'choice' ? 'choice' : 'base');
  const [name, setName] = useState(initial?.name || '');
  const [priceTickets, setPrice] = useState(
    String(initial?.priceTickets ?? (kind === 'choice' || kind === 'always' ? '0' : '')),
  );
  const [quantity, setQty] = useState(String(initial?.quantity ?? '20'));
  const [isAvailable, setAvail] = useState(initial?.isAvailable !== false);
  const [soldAlone, setSoldAlone] = useState(
    typeof initial?.soldAlone === 'boolean' ? initial.soldAlone : kind === 'base',
  );
  const included = kind === 'choice' || kind === 'always';
  const copy = included ? ROLE_COPY.with : ROLE_COPY[kind] || ROLE_COPY.base;

  const selectKind = (next) => {
    setKind(next);
    if (next === 'choice' || next === 'always') setPrice('0');
    if (!initial) setSoldAlone(next === 'base');
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--tall" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Modifier' : copy.title}</h2>
        <p className="sub">{copy.lead}</p>
        <Field label="C’est quoi ?">
          <div className="kind-picks">
            {[
              ['base', 'Plat de base'],
              ['extra', 'En plus'],
              ['choice', 'Sauce ou huile'],
              ['always', 'Toujours mis'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`kind-pick${kind === id ? ' on' : ''}`}
                onClick={() => selectKind(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Nom">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={copy.name}
          />
        </Field>
        {included ? (
          <p className="field-hint">
            {kind === 'choice'
              ? 'L’étudiant en choisit une seule, offerte avec le plat. Exemple : sauce ou huile.'
              : 'Ajouté tout seul avec le plat. Exemple : le piment. Pas de prix à part.'}
          </p>
        ) : (
          <Field label="Prix d’une part (tickets)" hint={copy.price}>
            <input
              inputMode="numeric"
              value={priceTickets}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
              placeholder="250"
            />
          </Field>
        )}
        {!initial ? (
          <Field label="Combien de parts en stock ?" hint="Une commande d’une part retire 1.">
            <input
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
              placeholder="20"
            />
          </Field>
        ) : null}
        <label className="check-row">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setAvail(e.target.checked)}
          />
          <span>Proposé aujourd’hui</span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={soldAlone}
            onChange={(e) => setSoldAlone(e.target.checked)}
          />
          <span>Peut se vendre seul</span>
        </label>
        <p className="field-hint">Décoche pour le piment, la sauce, le poisson…</p>
        <div className="sheet-actions">
          <button
            type="button"
            className="btn-action fill primary full"
            disabled={busy || !name.trim() || (!included && priceTickets === '')}
            onClick={() =>
              onSave({
                kind,
                name: name.trim(),
                unit: 'PORTION',
                priceTickets: included ? 0 : Number(priceTickets),
                isAvailable,
                soldAlone,
                lowStockThreshold: initial?.lowStockThreshold ?? 5,
                ...(initial ? {} : { quantity: Number(quantity || 0) }),
              })
            }
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {initial && onDelete ? (
            <button
              type="button"
              className="btn-action outline full"
              disabled={busy}
              onClick={() => onDelete(initial)}
            >
              Supprimer
            </button>
          ) : null}
          <button type="button" className="btn-action outline full" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuSheet({ components, categories, initial, onClose, onSave, onDelete, busy }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDesc] = useState(initial?.description || '');
  const [isActive, setActive] = useState(initial?.isActive !== false);
  const [selected, setSelected] = useState(() => {
    const map = {};
    (initial?.lines || []).forEach((l) => {
      map[l.componentId] = String(l.quantity || 1);
    });
    return map;
  });

  const toggle = (id) => {
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = '1';
      return next;
    });
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
        <h2>{initial ? 'Modifier le menu' : 'Menu fixé'}</h2>
        <p className="sub">
          L’étudiant le prend comme tu l’as composé. Il ne choisit pas les quantités.
        </p>
        <Field label="Nom">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Riz poisson" />
        </Field>
        <Field label="Description (optionnel)">
          <input
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Ce que le menu contient, en une phrase"
          />
        </Field>
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
                  <input
                    className="qty-mini"
                    inputMode="numeric"
                    aria-label={`Parts de ${c.name}`}
                    value={selected[c.id]}
                    onChange={(e) =>
                      setSelected((s) => ({
                        ...s,
                        [c.id]: e.target.value.replace(/\D/g, '') || '1',
                      }))
                    }
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setActive(e.target.checked)}
          />
          <span>Proposé aux étudiants</span>
        </label>
        <div className="sheet-actions">
          <button
            type="button"
            className="btn-action fill primary full"
            disabled={busy || !name.trim() || lines.length === 0}
            onClick={() =>
              onSave({
                name: name.trim(),
                description: description.trim() || undefined,
                isActive,
                lines,
              })
            }
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {initial && onDelete ? (
            <button
              type="button"
              className="btn-action outline full"
              disabled={busy}
              onClick={() => onDelete(initial)}
            >
              Supprimer
            </button>
          ) : null}
          <button type="button" className="btn-action outline full" onClick={onClose}>
            Annuler
          </button>
        </div>
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
        <h2>{initial ? 'Modifier l’emporté' : 'À emporter'}</h2>
        <p className="sub">Ajouté une seule fois quand l’étudiant choisit « à emporter ».</p>
        <Field label="Nom">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Barquette" />
        </Field>
        <Field label="Prix (tickets)">
          <input
            inputMode="numeric"
            value={priceTickets}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <label className="check-row">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setActive(e.target.checked)}
          />
          <span>Proposé aux étudiants</span>
        </label>
        <div className="sheet-actions">
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
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {initial && onDelete ? (
            <button
              type="button"
              className="btn-action outline full"
              disabled={busy}
              onClick={() => onDelete(initial)}
            >
              Supprimer
            </button>
          ) : null}
          <button type="button" className="btn-action outline full" onClick={onClose}>
            Annuler
          </button>
        </div>
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
  const [tab, setTab] = useState('base');
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
    const groups = { base: [], extra: [], choice: [], always: [], other: [] };
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

  useEffect(() => {
    if (tab === 'sort' && !grouped.other.length) setTab('base');
  }, [tab, grouped.other.length]);

  const tabs = useMemo(() => {
    const list = [
      { key: 'base', label: 'Base' },
      { key: 'extra', label: 'En plus' },
      { key: 'with', label: 'Avec' },
      { key: 'menus', label: 'Menus' },
      { key: 'takeaway', label: 'Emporté' },
    ];
    if (grouped.other.length) list.push({ key: 'sort', label: 'À ranger' });
    return list;
  }, [grouped.other.length]);

  const copy = ROLE_COPY[tab] || ROLE_COPY.base;

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
    }[body.kind];
    setBusy(true);
    try {
      const categoryId = await categoryIdFor(categoryName);
      const payload = {
        name: body.name,
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
      }[kind];
      const categoryId = await categoryIdFor(categoryName);
      await componentsApi.update(item.id, {
        categoryId,
        priceTickets: isIncludedRole(kind) ? 0 : Number(item.priceTickets || 0),
        soldAlone: kind === 'base',
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

  const openCreate = () => {
    if (tab === 'menus') setSheet({ type: 'menus', item: null });
    else if (tab === 'takeaway') setSheet({ type: 'takeaway', item: null });
    else if (tab === 'sort') return;
    else setSheet({ type: 'food', role: tab === 'with' ? 'choice' : tab, item: null });
  };

  const foodOf = (role) => grouped[role] || [];

  const renderFood = (item) => {
    const available = item.isAvailable !== false && Number(item.quantity) > 0;
    const role = roleOfComponent(item, categories);
    const included = isIncludedRole(role);
    return (
      <div key={item.id} className={`catalog-card${!available ? ' dim' : ''}`}>
        <div className="catalog-main">
          <strong>{item.name}</strong>
          <span>
            {included ? 'Offert avec le plat' : formatTickets(item.priceTickets)}
            {' · '}
            {item.quantity} part{Number(item.quantity) > 1 ? 's' : ''}
            {!item.isAvailable ? ' · masqué' : ''}
            {available ? '' : ' · épuisé'}
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

  const addLabel =
    tab === 'menus' ? 'Ajouter un menu fixé' : tab === 'takeaway' ? 'Ajouter une option' : tab === 'sort' ? '' : 'Ajouter';

  return (
    <div className="dashboard-body">
      <SubpageBar
        title="Ma carte"
        eyebrow="Cantine"
        onBack={onBack}
        action={
          addLabel ? (
            <button type="button" className="circle-action" onClick={openCreate} aria-label={addLabel}>
              <IconPlus />
            </button>
          ) : null
        }
      />

      <div className="sheet-body sheet-body--sub">
      <div className="section-tabs catalog-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`section-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

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
          <p className="catalog-lead">{copy.lead}</p>

          {tab === 'base' ? foodOf('base').map(renderFood) : null}
          {tab === 'extra' ? foodOf('extra').map(renderFood) : null}
          {tab === 'with' ? (
            <>
              <div className="kicker-inline">L’étudiant en choisit une</div>
              {foodOf('choice').map(renderFood)}
              {!foodOf('choice').length ? (
                <p className="catalog-note">Exemple : sauce, huile.</p>
              ) : null}
              <div className="kicker-inline">Toujours mis</div>
              {foodOf('always').map(renderFood)}
              {!foodOf('always').length ? <p className="catalog-note">Exemple : piment.</p> : null}
            </>
          ) : null}

          {tab === 'menus'
            ? menus.map((m) => (
                <div key={m.id} className={`catalog-card${!m.isActive ? ' dim' : ''}`}>
                  <div className="catalog-main">
                    <strong>{m.name}</strong>
                    <span>
                      {(m.lines || []).map((l) => l.name || l.component?.name).filter(Boolean).join(' · ') ||
                        'Rien dedans'}
                      {!m.isActive ? ' · masqué' : ''}
                    </span>
                  </div>
                  <div className="catalog-actions">
                    <button
                      type="button"
                      className="link-mini"
                      onClick={() => setSheet({ type: 'menus', item: m })}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="link-mini"
                      style={{ color: 'var(--red)' }}
                      onClick={() => removeMenu(m)}
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))
            : null}

          {tab === 'takeaway'
            ? options.map((o) => (
                <div key={o.id} className={`catalog-card${!o.isActive ? ' dim' : ''}`}>
                  <div className="catalog-main">
                    <strong>{o.name}</strong>
                    <span>
                      {formatTickets(o.priceTickets)}
                      {!o.isActive ? ' · masquée' : ''}
                    </span>
                  </div>
                  <div className="catalog-actions">
                    <button
                      type="button"
                      className="link-mini"
                      onClick={() => setSheet({ type: 'takeaway', item: o })}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="link-mini"
                      style={{ color: 'var(--red)' }}
                      onClick={() => removeTakeaway(o)}
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))
            : null}

          {tab === 'sort'
            ? grouped.other.map((item) => (
                <div key={item.id} className="catalog-card catalog-card--classify">
                  <div className="catalog-main">
                    <strong>{item.name}</strong>
                    <span>{formatTickets(item.priceTickets)} · pas encore à sa place</span>
                  </div>
                  <div className="classify-actions">
                    <button type="button" onClick={() => classify(item, 'base')}>Base</button>
                    <button type="button" onClick={() => classify(item, 'extra')}>En plus</button>
                    <button type="button" onClick={() => classify(item, 'choice')}>Sauce ou huile</button>
                    <button type="button" onClick={() => classify(item, 'always')}>Toujours mis</button>
                  </div>
                </div>
              ))
            : null}

          {tab === 'base' && !foodOf('base').length ? (
            <div className="empty-block">
              <div className="empty-nest">
                <div className="empty-nest-inner">
                  <IconPlus />
                </div>
              </div>
              <h3>Pas encore de plat de base</h3>
              <p>{copy.empty}</p>
            </div>
          ) : null}
          {tab === 'extra' && !foodOf('extra').length ? (
            <div className="empty-block">
              <h3>Rien en plus</h3>
              <p>{copy.empty}</p>
            </div>
          ) : null}
          {tab === 'with' && !foodOf('choice').length && !foodOf('always').length ? (
            <div className="empty-block">
              <h3>Rien n’accompagne le plat</h3>
              <p>{copy.empty}</p>
            </div>
          ) : null}
          {tab === 'menus' && !menus.length ? (
            <div className="empty-block">
              <h3>Aucun menu fixé</h3>
              <p>{copy.empty}</p>
            </div>
          ) : null}
          {tab === 'takeaway' && !options.length ? (
            <div className="empty-block">
              <h3>Pas d’emporté</h3>
              <p>{copy.empty}</p>
            </div>
          ) : null}
        </div>
      )}
      </div>
      </div>

      {addLabel ? (
        <div className="sticky-cta">
          <button type="button" className="btn-action fill primary full" onClick={openCreate}>
            {addLabel}
          </button>
        </div>
      ) : null}

      {sheet?.type === 'food' ? (
        <FoodSheet
          initial={sheet.item}
          role={sheet.role}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={saveFood}
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
