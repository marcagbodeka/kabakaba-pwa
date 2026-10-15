import VendorHeader from '../components/VendorHeader';
import { useAuth } from '../auth/AuthContext';
import { initialsFrom } from '../lib/format';

export default function ProfilePage({
  vendor,
  onCapacityTap,
  onNotificationTap,
  hasUnread,
  onOpenCatalog,
}) {
  const auth = useAuth();
  const initials = initialsFrom(vendor?.canteenName);

  return (
    <div className="dashboard-body">
      <VendorHeader
        vendor={vendor}
        showNotification
        hasUnread={hasUnread}
        onNotificationTap={onNotificationTap}
        onCapacityTap={onCapacityTap}
      />
      <div className="profile-card">
        <div className="profile-banner">
          {vendor?.bannerUrl ? <img src={vendor.bannerUrl} alt="" /> : null}
        </div>
        <div className="profile-main">
          <div className="profile-logo">
            {vendor?.logoUrl ? <img src={vendor.logoUrl} alt="" /> : initials}
          </div>
          <div>
            <div className="profile-name">{vendor?.canteenName || '—'}</div>
            {vendor?.campusName ? (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 6,
                  padding: '2px 8px',
                  borderRadius: 8,
                  background: 'var(--indigo-light)',
                  color: 'var(--primary)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {vendor.campusName}
              </span>
            ) : null}
            {vendor?.phone ? (
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                {vendor.phone}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="nav-rows">
        <button type="button" className="nav-row" onClick={onOpenCatalog}>
          <div>
            <strong>Mon catalogue</strong>
            <span>Stock, menus et options d’emporté</span>
          </div>
        </button>
        <button type="button" className="nav-row" onClick={onCapacityTap}>
          <div>
            <strong>Disponibilité</strong>
            <span>Ouverte · Occupée · Fermée</span>
          </div>
        </button>
        <button type="button" className="nav-row" onClick={() => auth.logout()}>
          <div>
            <strong>Se déconnecter</strong>
            <span>Revenir à l’écran PIN</span>
          </div>
        </button>
        <button
          type="button"
          className="nav-row"
          onClick={async () => {
            const ok = window.confirm(
              'Ton code sera oublié sur cet appareil. Tu devras te reconnecter avec ton numéro et ton mot de passe temporaire.',
            );
            if (ok) await auth.forget();
          }}
        >
          <div>
            <strong>Utiliser un autre compte</strong>
            <span>Oublier ce téléphone</span>
          </div>
        </button>
      </div>
    </div>
  );
}
