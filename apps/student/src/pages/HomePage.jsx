import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { vendorsApi } from '../lib/api';
import {
  CAPACITY_LABEL,
  formatTickets,
  initialsFrom,
} from '../lib/format';
import { IconOrders, IconStore, IconWallet } from '../components/icons';

export default function HomePage({ onNavigate, showSnack }) {
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
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

  const firstName = user?.firstName || 'Étudiant';
  const balance = Number(user?.walletBalance ?? 0);

  return (
    <div className="page">
      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-greet">Bonjour</div>
            <div className="hero-name">{firstName}</div>
          </div>
        </div>
        <div className="hero-balance">
          <label>Solde tickets</label>
          <strong>{formatTickets(balance)}</strong>
        </div>
      </div>

      <div className="sheet-body">
        <div className="kicker">Aujourd’hui</div>
        <div className="section-title">Accès rapide</div>
        <div className="bento">
          <button type="button" className="bento-card" onClick={() => onNavigate('canteens')}>
            <IconStore />
            <strong>Cantines</strong>
            <span>Voir ce qui est dispo</span>
          </button>
          <button type="button" className="bento-card" onClick={() => onNavigate('orders')}>
            <IconOrders />
            <strong>Commandes</strong>
            <span>Suivre tes repas</span>
          </button>
          <button type="button" className="bento-card" onClick={() => onNavigate('wallet')}>
            <IconWallet />
            <strong>Portefeuille</strong>
            <span>Ton solde tickets</span>
          </button>
          <button type="button" className="bento-card" onClick={() => onNavigate('cart')}>
            <IconStore />
            <strong>Panier</strong>
            <span>Finaliser une commande</span>
          </button>
        </div>

        <div className="section-row">
          <div>
            <div className="kicker">Campus</div>
            <div className="section-title" style={{ marginBottom: 0 }}>
              Cantines
            </div>
          </div>
          <button type="button" className="link-accent" onClick={() => onNavigate('canteens')}>
            Voir tout
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
            <div className="spinner" />
          </div>
        ) : vendors.length === 0 ? (
          <div className="empty">
            <h3>Aucune cantine</h3>
            <p>Reviens plus tard ou contacte le support.</p>
          </div>
        ) : (
          vendors.slice(0, 6).map((v) => (
            <button
              key={v.id}
              type="button"
              className="canteen-card"
              onClick={() => onNavigate('canteen', { vendorId: v.id })}
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
