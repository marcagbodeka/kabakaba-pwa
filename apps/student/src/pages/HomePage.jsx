import { useEffect, useState } from 'react';
import { BalanceEye, useBalanceHidden } from '../components/BalanceEye';
import { useAuth } from '../context/AuthContext';
import { notificationsApi, vendorsApi } from '../lib/api';
import { formatTicketCount, initialsFrom } from '../lib/format';
import { readView, writeView } from '../lib/instantView';
import { warmCanteen } from '../lib/warmCanteen';

function IconSearch() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.7 9.1c0-3.3 2.4-5.9 5.3-5.9s5.3 2.6 5.3 5.9l1.1 4.5c.2.7-.3 1.4-1 1.4H6.6c-.7 0-1.2-.7-1-1.4l1.1-4.5Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
      <path d="M12 3.4v1.2" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M21 12a9 9 0 1 1-2.6-6.3" />
      <path d="M21 4v6h-6" />
    </svg>
  );
}

function IconRestaurant() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 3v8a2 2 0 0 0 2 2h1v8" />
      <path d="M7 3v6M10 3v6M18 3v18M18 3a3 3 0 0 1 0 6" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function IconReceipt() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2h9l3 3v17l-3-2-3 2-3-2-3 2V2Z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function IconSupport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3a7 7 0 0 0-7 7v3a3 3 0 0 0 3 3h1v-5H7a5 5 0 0 1 10 0h-2v5h1a3 3 0 0 0 3-3v-3a7 7 0 0 0-7-7Z" />
      <path d="M9 21h6" />
    </svg>
  );
}

function IconCrown() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m3 8 4 4 5-7 5 7 4-4v11H3V8Z" />
    </svg>
  );
}

function vendorCapacity(v) {
  return String(v?.capacityStatus || 'CLOSED').toUpperCase();
}

function isVendorOpen(v) {
  return vendorCapacity(v) === 'OPEN';
}

function vendorCapacityLabel(v) {
  const status = vendorCapacity(v);
  if (status === 'OPEN') return 'Ouverte';
  if (status === 'BUSY') return 'Occupée';
  return 'Fermée';
}

export default function HomePage({ onNavigate, showSnack }) {
  const { user } = useAuth();
  const [vendors, setVendors] = useState(() => readView('vendors') || []);
  const [loading, setLoading] = useState(() => !readView('vendors'));
  const [unread, setUnread] = useState(() => readView('unread') || 0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!readView('vendors')) setLoading(true);
      try {
        const list = await vendorsApi.list(user?.campusId);
        const rows = Array.isArray(list) ? list : [];
        if (!cancelled) {
          setVendors(rows);
          writeView('vendors', rows);
          rows.slice(0, 3).forEach((v) => warmCanteen(v.id));
        }
      } catch (e) {
        if (!cancelled && !readView('vendors')) {
          showSnack?.(e.message || 'Cantines indisponibles');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    notificationsApi
      .list()
      .then((rows) => {
        if (cancelled) return;
        const count = (rows || []).filter((n) => !n.isRead).length;
        setUnread(count);
        writeView('unread', count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showSnack, user?.campusId]);

  const firstName = user?.firstName || 'Étudiant';
  const balance = formatTicketCount(user?.walletBalance ?? 0);
  const { hidden: balanceHidden, toggle: toggleBalance } = useBalanceHidden();

  return (
    <div className="page page--flush">
      <div className="hero hero--home">
        <div className="hero-top">
          <div>
            <div className="hero-greet">Bon retour</div>
            <div className="hero-name">Bonjour, {firstName}</div>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="hero-icon-btn"
              aria-label="Rechercher"
              onClick={() => onNavigate('canteens')}
            >
              <IconSearch />
            </button>
            <button
              type="button"
              className={`hero-icon-btn${unread ? ' hero-icon-btn--alert' : ''}`}
              aria-label="Notifications"
              onClick={() => onNavigate('profile', { panel: 'notes' })}
            >
              <IconBell />
              {unread > 0 ? (
                <span className="hero-badge">{unread > 9 ? '9+' : unread}</span>
              ) : null}
            </button>
          </div>
        </div>

        <div className="hero-balance-row">
          <BalanceEye hidden={balanceHidden} onToggle={toggleBalance} />
          <span>Solde tickets</span>
        </div>
        <div className="hero-balance-amount">
          {balanceHidden ? '••••' : `${balance} tickets`}
        </div>

        <div className="hero-pills">
          <button type="button" className="hero-pill hero-pill--primary" onClick={() => onNavigate('wallet')}>
            <IconPlus />
            Recharger
          </button>
          <button type="button" className="hero-pill" onClick={() => onNavigate('wallet')}>
            <IconRefresh />
            Historique
          </button>
        </div>
      </div>

      <div className="sheet-body">
        <div className="kicker">Aujourd’hui</div>
        <div className="section-title">Accès rapide</div>

        <div className="bento-home">
          <button
            type="button"
            className="feature-tile feature-tile--featured"
            onClick={() => onNavigate('canteens')}
          >
            <span className="feature-icon feature-icon--lg">
              <IconRestaurant />
            </span>
            <strong>Commander</strong>
            <span>Cantines ouvertes près de toi</span>
          </button>
          <div className="bento-stack">
            <button type="button" className="feature-tile" onClick={() => onNavigate('wallet')}>
              <span className="feature-icon">
                <IconCard />
              </span>
              <div>
                <strong>Recharger</strong>
                <span>Flooz / Mixx</span>
              </div>
            </button>
            <button type="button" className="feature-tile" onClick={() => onNavigate('orders')}>
              <span className="feature-icon">
                <IconReceipt />
              </span>
              <div>
                <strong>Commandes</strong>
                <span>Suivi & retrait</span>
              </div>
            </button>
          </div>
        </div>

        <button
          type="button"
          className="help-row"
          onClick={() => onNavigate('profile', { panel: 'help' })}
        >
          <span className="help-row-icon">
            <IconSupport />
          </span>
          <span className="help-row-text">
            <strong>Aide & support</strong>
            <span>FAQ, litiges, campus</span>
          </span>
          <span className="help-row-chevron">›</span>
        </button>

        <button
          type="button"
          className="promo-banner"
          onClick={() => onNavigate('profile', { panel: 'referral' })}
        >
          <span className="promo-banner-icon">
            <IconCrown />
          </span>
          <span className="promo-banner-text">
            <strong>Parrainage kabakaba</strong>
            <span>Invite un ami : 100 tickets à sa 1ʳᵉ recharge</span>
          </span>
          <span className="promo-banner-arrow">→</span>
        </button>

        <div className="section-row" style={{ marginTop: 28 }}>
          <div>
            <div className="kicker">Campus</div>
            <div className="section-title" style={{ marginBottom: 0 }}>
              Cantines du campus
            </div>
          </div>
          <button type="button" className="link-accent" onClick={() => onNavigate('canteens')}>
            Voir plus
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
            <div className="spinner" />
          </div>
        ) : vendors.length === 0 ? (
          <div className="empty-soft">
            <div className="empty-soft-icon">{initialsFrom('KB')}</div>
            <p>Aucune cantine pour le moment</p>
          </div>
        ) : (
          <div className="canteen-cover-rail">
            {vendors.slice(0, 3).map((v) => {
              const open = isVendorOpen(v);
              const image = v.bannerUrl || v.logoUrl;
              return (
                <button
                  key={v.id}
                  type="button"
                  className={`canteen-cover-card canteen-cover-card--rail${!open ? ' is-closed' : ''}`}
                  onClick={() => onNavigate('canteen', { vendorId: v.id })}
                >
                  {image ? (
                    <img src={image} alt="" decoding="async" />
                  ) : (
                    <div className="canteen-cover-fallback">
                      <IconRestaurant />
                    </div>
                  )}
                  <span className="canteen-cover-shade" />
                  <span className={`canteen-poster-pill${open ? ' open' : ''}`}>
                    {vendorCapacityLabel(v)}
                  </span>
                  <span className="canteen-cover-meta">
                    <strong>{v.canteenName}</strong>
                    {v.description ? <span>{v.description}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
