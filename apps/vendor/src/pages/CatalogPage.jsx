import { useCallback, useEffect, useMemo, useState } from 'react';
import SubpageBar from '../components/SubpageBar';
import { IconPlus } from '../components/icons';
import {
  categoriesApi,
  componentsApi,
  menusApi,
  takeawayApi,
} from '../lib/api';
import { UNIT_LABEL, UNIT_OPTIONS, formatTickets } from '../lib/format';

const TABS = [
  { key: 'components', label: 'Stock' },
  { key: 'categories', label: 'Catégories' },
  { key: 'menus', label: 'Menus' },
  { key: 'takeaway', label: 'Emporté' },
];

function Field({ label, children }) {
  return (
    <div className="vfield">
      <label>{label}</label>
      {children}
    </div>
  );
}

function ComponentSheet({ initial, categories = [], onClose, onSave, busy }) {
  const [name, setName] = useState(initial?.name || '');
  const [unit, setUnit] = useState(initial?.unit || 'PORTION');
  const [categoryId, setCategoryId] = useState(initial?.categoryId || '');
  const [priceTickets, setPrice] = useState(String(initial?.priceTickets ?? ''));
  const [quantity, setQty] = useState(String(initial?.quantity ?? '0'));
  const [isAvailable, setAvail] = useState(initial?.isAvailable !== false);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--tall" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Modifier le composant' : 'Nouveau composant'}</h2>
        <p className="sub">Visible des étudiants seulement si disponible et en stock.</p>
        <Field label="Nom">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Riz" />
        </Field>
        <Field label="Catégorie">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sans catégorie</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unité">
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prix (tickets)">
          <input
            inputMode="numeric"
            value={priceTickets}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
          />
        </Field>
        {!initial ? (
          <Field label="Stock initial">
            <input
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
            />
          </Field>
        ) : null}
        <label className="check-row">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setAvail(e.target.checked)}
          />
          <span>Proposé aux étudiants</span>
        </label>
        <div className="sheet-actions">
          <button
            type="button"
            className="btn-action fill primary full"
            disabled={busy || !name.trim() || priceTickets === ''}
            onClick={() =>
              onSave({
                name: name.trim(),
                unit,
                priceTickets: Number(priceTickets),
                isAvailable,
                ...(categoryId ? { categoryId } : {}),
                ...(initial ? {} : { quantity: Number(quantity || 0) }),
              })
            }
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className="btn-action outline full" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuSheet({ components, initial, onClose, onSave, busy }) {
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

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet--tall" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Modifier le menu' : 'Nouveau menu'}</h2>
        <p className="sub">Compose un plat à partir de tes composants en stock.</p>
        <Field label="Nom">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Riz sauce" />
        </Field>
        <Field label="Description (optionnel)">
          <input
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Court descriptif"
          />
        </Field>
        <div className="kicker-inline">Composants</div>
        <div className="pick-list">
          {components.map((c) => {
            const on = selected[c.id] != null;
            return (
              <div key={c.id} className={`pick-row${on ? ' on' : ''}`}>
                <button type="button" className="pick-main" onClick={() => toggle(c.id)}>
                  <strong>{c.name}</strong>
                  <span>
                    {formatTickets(c.priceTickets)} · {UNIT_LABEL[c.unit] || c.unit}
                  </span>
                </button>
                {on ? (
                  <input
                    className="qty-mini"
                    inputMode="numeric"
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
          <span>Menu actif</span>
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
          <button type="button" className="btn-action outline full" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

function CategorySheet({ initial, onClose, onSave, busy }) {
  const [name, setName] = useState(initial?.name || '');
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Renommer la catégorie' : 'Nouvelle catégorie'}</h2>
        <Field label="Nom">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex. Protéine" />
        </Field>
        <div className="sheet-actions">
          <button
            type="button"
            className="btn-action fill primary full"
            disabled={busy || !name.trim()}
            onClick={() => onSave({ name: name.trim() })}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className="btn-action outline full" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

function TakeawaySheet({ initial, onClose, onSave, busy }) {
  const [name, setName] = useState(initial?.name || '');
  const [priceTickets, setPrice] = useState(String(initial?.priceTickets ?? '0'));
  const [isActive, setActive] = useState(initial?.isActive !== false);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Modifier l’option' : 'Option d’emporté'}</h2>
        <p className="sub">Frais ajoutés quand l’étudiant choisit « à emporter ».</p>
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
          <span>Option active</span>
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
          <button type="button" className="btn-action outline full" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CatalogPage({ vendor, onBack, showSnack }) {
  const vendorId = vendor?.id;
  const [tab, setTab] = useState('components');
  const [components, setComponents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [menus, setMenus] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null); // { type, item? }

  const reload = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const [c, cats, m, t] = await Promise.all([
        componentsApi.manage(vendorId),
        categoriesApi.list(vendorId),
        menusApi.manage(vendorId),
        takeawayApi.manage(vendorId),
      ]);
      setComponents(c);
      setCategories(cats);
      setMenus(m);
      setOptions(t);
    } catch (e) {
      showSnack(e.message || 'Catalogue indisponible');
    } finally {
      setLoading(false);
    }
  }, [vendorId, showSnack]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addLabel = useMemo(() => {
    if (tab === 'menus') return 'Ajouter un menu';
    if (tab === 'takeaway') return 'Ajouter une option';
    if (tab === 'categories') return 'Ajouter une catégorie';
    return 'Ajouter un composant';
  }, [tab]);

  const openCreate = () => setSheet({ type: tab, item: null });

  const saveComponent = async (body) => {
    setBusy(true);
    try {
      if (sheet?.item) await componentsApi.update(sheet.item.id, body);
      else await componentsApi.create(body);
      setSheet(null);
      await reload();
      showSnack('Composant enregistré');
    } catch (e) {
      showSnack(e.message || 'Échec');
    } finally {
      setBusy(false);
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

  const saveCategory = async (body) => {
    setBusy(true);
    try {
      if (sheet?.item) await categoriesApi.update(sheet.item.id, body);
      else await categoriesApi.create(body);
      setSheet(null);
      await reload();
      showSnack('Catégorie enregistrée');
    } catch (e) {
      showSnack(e.message || 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const removeCategory = async (id) => {
    const ok = window.confirm('Supprimer cette catégorie ? Les composants encore rattachés bloquent la suppression.');
    if (!ok) return;
    try {
      await categoriesApi.remove(id);
      await reload();
    } catch (e) {
      showSnack(e.message || 'Suppression impossible');
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

  return (
    <div className="dashboard-body">
      <SubpageBar
        title="Mon catalogue"
        onBack={onBack}
        action={
          <button type="button" className="circle-action" onClick={openCreate} aria-label={addLabel}>
            <IconPlus />
          </button>
        }
      />

      <div className="section-tabs">
        {TABS.map((t) => (
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

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="catalog-list">
          {tab === 'components'
            ? components.map((c) => {
                const available = c.isAvailable !== false && Number(c.quantity) > 0;
                return (
                  <div key={c.id} className={`catalog-card${!available ? ' dim' : ''}`}>
                    <div className="catalog-main">
                      <strong>{c.name}</strong>
                      <span>
                        {formatTickets(c.priceTickets)} · stock {c.quantity}{' '}
                        {UNIT_LABEL[c.unit] || ''}
                        {!c.isAvailable ? ' · masqué' : ''}
                      </span>
                    </div>
                    <div className="catalog-actions">
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={async () => {
                          try {
                            await componentsApi.adjustStock(c.id, -1);
                            await reload();
                          } catch (e) {
                            showSnack(e.message);
                          }
                        }}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={async () => {
                          try {
                            await componentsApi.adjustStock(c.id, 1);
                            await reload();
                          } catch (e) {
                            showSnack(e.message);
                          }
                        }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="link-mini"
                        onClick={() => setSheet({ type: 'components', item: c })}
                      >
                        Éditer
                      </button>
                    </div>
                  </div>
                );
              })
            : null}

          {tab === 'categories'
            ? categories.map((cat) => (
                <div key={cat.id} className="catalog-card">
                  <div className="catalog-main">
                    <strong>{cat.name}</strong>
                    <span>
                      {components.filter((c) => c.categoryId === cat.id).length} composant
                      {components.filter((c) => c.categoryId === cat.id).length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="catalog-actions">
                    <button
                      type="button"
                      className="link-mini"
                      onClick={() => setSheet({ type: 'categories', item: cat })}
                    >
                      Éditer
                    </button>
                    <button type="button" className="link-mini" onClick={() => removeCategory(cat.id)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))
            : null}

          {tab === 'menus'
            ? menus.map((m) => (
                <div key={m.id} className={`catalog-card${!m.isActive ? ' dim' : ''}`}>
                  <div className="catalog-main">
                    <strong>{m.name}</strong>
                    <span>
                      {(m.lines || []).map((l) => l.name || l.componentId).join(' · ') ||
                        'Sans lignes'}
                      {!m.isActive ? ' · inactif' : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="link-mini"
                    onClick={() => setSheet({ type: 'menus', item: m })}
                  >
                    Éditer
                  </button>
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
                      {!o.isActive ? ' · inactive' : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="link-mini"
                    onClick={() => setSheet({ type: 'takeaway', item: o })}
                  >
                    Éditer
                  </button>
                </div>
              ))
            : null}

          {tab === 'components' && !components.length ? (
            <div className="empty-block">
              <h3>Aucun composant</h3>
              <p>Ajoute ton stock pour composer des menus et recevoir des commandes.</p>
            </div>
          ) : null}
          {tab === 'categories' && !categories.length ? (
            <div className="empty-block">
              <h3>Aucune catégorie</h3>
              <p>Range tes composants pour que les étudiants les retrouvent plus vite.</p>
            </div>
          ) : null}
          {tab === 'menus' && !menus.length ? (
            <div className="empty-block">
              <h3>Aucun menu</h3>
              <p>Crée des plats pré-composés à partir de tes composants.</p>
            </div>
          ) : null}
          {tab === 'takeaway' && !options.length ? (
            <div className="empty-block">
              <h3>Pas d’option d’emporté</h3>
              <p>Sans option active, les étudiants ne peuvent commander que sur place.</p>
            </div>
          ) : null}
        </div>
      )}

      <div className="sticky-cta">
        <button type="button" className="btn-action fill primary full" onClick={openCreate}>
          {addLabel}
        </button>
      </div>

      {sheet?.type === 'components' ? (
        <ComponentSheet
          initial={sheet.item}
          categories={categories}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={saveComponent}
        />
      ) : null}
      {sheet?.type === 'categories' ? (
        <CategorySheet
          initial={sheet.item}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={saveCategory}
        />
      ) : null}
      {sheet?.type === 'menus' ? (
        <MenuSheet
          components={components}
          initial={sheet.item}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={saveMenu}
        />
      ) : null}
      {sheet?.type === 'takeaway' ? (
        <TakeawaySheet
          initial={sheet.item}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={saveTakeaway}
        />
      ) : null}
    </div>
  );
}
