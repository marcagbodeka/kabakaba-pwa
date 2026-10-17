import { useRef, useState } from 'react';
import VendorHeader from '../components/VendorHeader';
import { useAuth } from '../auth/AuthContext';
import { mediaApi, vendorApi } from '../lib/api';
import { initialsFrom } from '../lib/format';

export default function ProfilePage({
  vendor,
  onCapacityTap,
  onNotificationTap,
  hasUnread,
  onOpenCatalog,
  onUpdated,
  onVendorRefresh,
  showSnack,
}) {
  const auth = useAuth();
  const initials = initialsFrom(vendor?.canteenName);
  const logoRef = useRef(null);
  const bannerRef = useRef(null);
  const [uploading, setUploading] = useState(null);
  const [editing, setEditing] = useState(false);
  const [canteenName, setCanteenName] = useState(vendor?.canteenName || '');
  const [description, setDescription] = useState(vendor?.description || '');
  const [busy, setBusy] = useState(false);

  const upload = async (kind, file) => {
    if (!file) return;
    setUploading(kind);
    try {
      if (kind === 'logo') await mediaApi.uploadLogo(file);
      else await mediaApi.uploadBanner(file);
      await onVendorRefresh?.();
      showSnack?.('Image mise à jour');
    } catch (e) {
      showSnack?.(e.message || 'Envoi impossible');
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!vendor?.id) return;
    setBusy(true);
    try {
      const updated = await vendorApi.update(vendor.id, {
        canteenName: canteenName.trim(),
        description: description.trim(),
      });
      onUpdated?.(updated);
      setEditing(false);
      showSnack?.('Cantine mise à jour');
    } catch (e) {
      showSnack?.(e.message || 'Mise à jour impossible');
    } finally {
      setBusy(false);
    }
  };

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
          <button
            type="button"
            className="profile-media-btn"
            disabled={uploading === 'banner'}
            onClick={() => bannerRef.current?.click()}
          >
            {uploading === 'banner' ? '…' : 'Bannière'}
          </button>
          <input
            ref={bannerRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => {
              upload('banner', e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <div className="profile-main">
          <div className="profile-logo">
            {vendor?.logoUrl ? <img src={vendor.logoUrl} alt="" /> : initials}
          </div>
          <button
            type="button"
            className="profile-media-btn profile-media-btn--logo"
            disabled={uploading === 'logo'}
            onClick={() => logoRef.current?.click()}
          >
            {uploading === 'logo' ? '…' : 'Logo'}
          </button>
          <input
            ref={logoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => {
              upload('logo', e.target.files?.[0]);
              e.target.value = '';
            }}
          />
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

      {editing ? (
        <div className="nav-rows" style={{ padding: 16 }}>
          <div className="vfield">
            <label>Nom de la cantine</label>
            <input value={canteenName} onChange={(e) => setCanteenName(e.target.value)} />
          </div>
          <div className="vfield">
            <label>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button
            type="button"
            className="btn-action fill primary full"
            disabled={busy || !canteenName.trim()}
            onClick={save}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      ) : null}

      <div className="nav-rows">
        <button
          type="button"
          className="nav-row"
          onClick={() => {
            setCanteenName(vendor?.canteenName || '');
            setDescription(vendor?.description || '');
            setEditing((v) => !v);
          }}
        >
          <div>
            <strong>Présentation</strong>
            <span>Nom et description de la cantine</span>
          </div>
        </button>
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
