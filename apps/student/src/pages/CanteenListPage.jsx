import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { campusApi, vendorsApi } from '../lib/api';
import { IconBack } from '../components/icons';
import { readView, writeView } from '../lib/instantView';
import { warmCanteen } from '../lib/warmCanteen';

function isOpen(v) {
  return String(v?.capacityStatus || '').toUpperCase() === 'OPEN';
}

function Poster({ vendor, onSelect }) {
  const open = isOpen(vendor);
  const image = vendor.bannerUrl || vendor.logoUrl;
  return (
    <button
      type="button"
      className={`canteen-cover-card${!open ? ' is-closed' : ''}`}
      onClick={() => onSelect(vendor.id)}
    >
      {image ? (
        <img src={image} alt="" decoding="async" />
      ) : (
        <div className="canteen-cover-fallback">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 3v8a2 2 0 0 0 2 2h1v8" />
            <path d="M7 3v6M10 3v6M18 3v18M18 3a3 3 0 0 1 0 6" />
          </svg>
        </div>
      )}
      <span className="canteen-cover-shade" />
      <span className={`canteen-poster-pill${open ? ' open' : ''}`}>{open ? 'Ouverte' : 'Fermée'}</span>
      <span className="canteen-cover-meta">
        <strong>{vendor.canteenName}</strong>
        {vendor.description ? <span>{vendor.description}</span> : null}
      </span>
    </button>
  );
}

export default function CanteenListPage({ onBack, onSelect, showSnack }) {
  const { user } = useAuth();
  const [vendors, setVendors] = useState(() => readView('vendors') || []);
  const [loading, setLoading] = useState(() => !readView('vendors'));
  const [query, setQuery] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [campusName, setCampusName] = useState('');

  const load = async () => {
    if (!readView('vendors')) setLoading(true);
    try {
      const list = await vendorsApi.list();
      const rows = Array.isArray(list) ? list : [];
      setVendors(rows);
      writeView('vendors', rows);
      rows.slice(0, 6).forEach((v) => warmCanteen(v.id));
    } catch (e) {
      if (!readView('vendors')) showSnack?.(e.message || 'Cantines indisponibles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!user?.campusId) {
      setCampusName('');
      return;
    }
    const cachedName = readView(`campus:${user.campusId}`);
    if (typeof cachedName === 'string') setCampusName(cachedName);
    campusApi
      .get(user.campusId)
      .then((c) => {
        const name = c?.name || '';
        setCampusName(name);
        if (name) writeView(`campus:${user.campusId}`, name);
      })
      .catch(() => {
        if (!cachedName) setCampusName('');
      });
  }, [user?.campusId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vendors.filter((v) => {
      if (openOnly && !isOpen(v)) return false;
      if (!q) return true;
      const hay = `${v.canteenName || ''} ${v.description || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vendors, query, openOnly]);

  const openCount = vendors.filter(isOpen).length;

  return (
    <div className="page page--flush">
      <div className="topbar">
        <button type="button" className="soft-back" onClick={onBack} aria-label="Retour">
          <IconBack />
        </button>
        <h1>Cantines</h1>
        <button type="button" className="icon-btn" aria-label="Actualiser" onClick={load}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-2.6-6.3" />
            <path d="M21 4v6h-6" />
          </svg>
        </button>
      </div>

      <div className="list-pad">
        <div className="kaba-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cantines, plats…"
            aria-label="Rechercher"
          />
        </div>

        <div className="kicker kicker--muted">{campusName || 'Ton campus'}</div>
        <div className="section-title">
          {openCount > 0 ? `${openCount} ouvertes près de toi` : 'Cantines à proximité'}
        </div>

        <div className="filter-chips">
          <button
            type="button"
            className={`filter-chip${!openOnly ? ' active' : ''}`}
            onClick={() => setOpenOnly(false)}
          >
            Toutes
          </button>
          <button
            type="button"
            className={`filter-chip${openOnly ? ' active' : ''}`}
            onClick={() => setOpenOnly(true)}
          >
            Ouvertes
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9h18l-1 11H4L3 9Z" />
                <path d="M3 9 5 4h14l2 5" />
              </svg>
            </div>
            <h3>Aucune cantine</h3>
            <p>Rien ne correspond à ta recherche pour le moment.</p>
          </div>
        ) : (
          <div className="canteen-cover-stack">
            {filtered.map((v) => (
              <Poster key={v.id} vendor={v} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
