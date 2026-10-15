import { useEffect, useState } from 'react';
import { vendorsApi } from '../lib/api';
import { CAPACITY_LABEL, initialsFrom } from '../lib/format';
import { IconBack } from '../components/icons';

export default function CanteenListPage({ onBack, onSelect, showSnack }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await vendorsApi.list();
        setVendors(Array.isArray(list) ? list : []);
      } catch (e) {
        showSnack(e.message || 'Cantines indisponibles');
      } finally {
        setLoading(false);
      }
    })();
  }, [showSnack]);

  return (
    <div className="page page--flush">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Retour">
          <IconBack />
        </button>
        <h1>Cantines</h1>
        <div style={{ width: 40 }} />
      </div>
      <div className="list-pad">
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : (
          vendors.map((v) => (
            <button
              key={v.id}
              type="button"
              className="canteen-card"
              onClick={() => onSelect(v.id)}
            >
              <div className="canteen-thumb">
                {v.logoUrl ? <img src={v.logoUrl} alt="" /> : initialsFrom(v.canteenName)}
              </div>
              <div>
                <h3>{v.canteenName}</h3>
                <p>{v.description || 'Cantine kabakaba'}</p>
                <span className={`pill ${String(v.capacityStatus || 'CLOSED').toLowerCase()}`}>
                  {CAPACITY_LABEL[v.capacityStatus] || 'Fermée'}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
