import { useEffect, useRef, useState } from 'react';
import VendorHeader from '../components/VendorHeader';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/ConfirmDialog';
import { mediaApi, vendorApi } from '../lib/api';
import { CAPACITY_LABEL, initialsFrom } from '../lib/format';
import {
  getNotificationPermission,
  getPushBlockedHelp,
  isWebPushConfigured,
  registerWebPush,
} from '../lib/push';

const ORDER_SOUND_MUTE_KEY = 'kaba_vendor_order_sounds_muted';

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
  const confirm = useConfirm();
  const initials = initialsFrom(vendor?.canteenName);
  const logoRef = useRef(null);
  const bannerRef = useRef(null);
  const [uploading, setUploading] = useState(null);
  const [editing, setEditing] = useState(false);
  const [canteenName, setCanteenName] = useState(vendor?.canteenName || '');
  const [description, setDescription] = useState(vendor?.description || '');
  const [busy, setBusy] = useState(false);
  const [soundMuted, setSoundMuted] = useState(
    () => localStorage.getItem(ORDER_SOUND_MUTE_KEY) === '1',
  );
  const [pushBusy, setPushBusy] = useState(false);
  const [pushPerm, setPushPerm] = useState(() => getNotificationPermission());
  const [pushOn, setPushOn] = useState(() => getNotificationPermission() === 'granted');

  useEffect(() => {
    setCanteenName(vendor?.canteenName || '');
    setDescription(vendor?.description || '');
  }, [vendor?.canteenName, vendor?.description]);

  useEffect(() => {
    const syncPerm = () => {
      const perm = getNotificationPermission();
      setPushPerm(perm);
      if (perm === 'granted' && isWebPushConfigured()) {
        registerWebPush()
          .then((token) => setPushOn(Boolean(token) || perm === 'granted'))
          .catch(() => setPushOn(true));
      } else {
        setPushOn(false);
      }
    };
    syncPerm();
    const onVis = () => {
      if (document.visibilityState === 'visible') syncPerm();
    };
    window.addEventListener('focus', syncPerm);
    document.addEventListener('visibilitychange', onVis);
    let permStatus;
    try {
      navigator.permissions
        ?.query({ name: 'notifications' })
        .then((status) => {
          permStatus = status;
          status.onchange = syncPerm;
        })
        .catch(() => {});
    } catch {
      /* ignore */
    }
    return () => {
      window.removeEventListener('focus', syncPerm);
      document.removeEventListener('visibilitychange', onVis);
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  const suspended = vendor?.isActive === false;
  const capacity = vendor?.capacityStatus || 'CLOSED';

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
    setBusy(true);
    try {
      const updated = await vendorApi.patchMe({
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

  const toggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    localStorage.setItem(ORDER_SOUND_MUTE_KEY, next ? '1' : '0');
    showSnack?.(next ? 'Sons de commande coupés' : 'Sons de commande activés');
  };

  return (
    <div className="dashboard-body">
      <VendorHeader
        vendor={vendor}
        showNotification
        hasUnread={hasUnread}
        onNotificationTap={onNotificationTap}
        onCapacityTap={onCapacityTap}
        eyebrow="Mon profil"
        compact
      />

      <div className="sheet-body">
      <div className="profile-scroll">
      {suspended ? (
        <div className="suspension-banner">
          <strong>Compte suspendu</strong>
          <p>
            {vendor?.suspensionReason ||
              'Ton espace vendeur est temporairement désactivé. Contacte l’administration.'}
          </p>
        </div>
      ) : null}

      <div className="push-settings-card" id="push-settings">
        <div className="push-settings-head">
          <div className="push-settings-icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div>
            <strong>Notifications push</strong>
            <p>
              {pushBusy
                ? 'Activation en cours…'
                : pushPerm === 'denied'
                  ? 'Bloquées dans le navigateur — autorise kabakaba dans les réglages du site.'
                  : !isWebPushConfigured()
                    ? 'Config Firebase manquante sur ce déploiement.'
                    : pushOn
                      ? 'Activées sur cet appareil — alertes nouvelles commandes.'
                      : 'Active pour recevoir les alertes de nouvelles commandes.'}
            </p>
          </div>
        </div>
        {pushPerm === 'denied' ? (
          <button
            type="button"
            className="push-settings-unblock"
            onClick={() => showSnack?.(getPushBlockedHelp())}
          >
            Comment débloquer
          </button>
        ) : (
          <label className="push-settings-toggle">
            <span>{pushOn ? 'Activé' : 'Désactivé'}</span>
            <input
              type="checkbox"
            checked={pushOn}
            disabled={pushBusy || pushOn || !isWebPushConfigured()}
              onChange={async (e) => {
              const wantOn = e.target.checked;
              if (!wantOn) return;
              setPushBusy(true);
                try {
                  try {
                    sessionStorage.removeItem('kabakaba_vendor_push_later');
                  } catch {
                    /* ignore */
                  }
                  const token = await registerWebPush({ forcePrompt: true });
                  const perm = getNotificationPermission();
                  setPushPerm(perm);
                  if (token) {
                    setPushOn(true);
                    showSnack?.('Notifications activées');
                  } else {
                    setPushOn(false);
                    if (perm === 'denied') {
                      showSnack?.(getPushBlockedHelp());
                    } else {
                      showSnack?.('Accepte la popup du navigateur pour activer');
                    }
                  }
                } finally {
                  setPushBusy(false);
                }
              }}
            />
          </label>
        )}
      </div>

      <div className="profile-card">
        <div className="profile-banner">
          {vendor?.bannerUrl ? <img src={vendor.bannerUrl} alt="" /> : null}
          <button
            type="button"
            className="profile-media-btn"
            disabled={uploading === 'banner' || suspended}
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
            disabled={uploading === 'logo' || suspended}
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
              <span className="profile-campus-pill">{vendor.campusName}</span>
            ) : null}
            <span className="profile-active-pill">
              {suspended ? 'Suspendu' : 'Vendeur actif'}
            </span>
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
            disabled={busy || !canteenName.trim() || suspended}
            onClick={save}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      ) : null}

      <div className="profile-section-label">Carte</div>
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
        <button type="button" className="nav-row" onClick={onOpenCatalog} disabled={suspended}>
          <div>
            <strong>Ma carte</strong>
            <span>Plat de base, en plus, menus fixés</span>
          </div>
        </button>
        <button type="button" className="nav-row" onClick={onCapacityTap} disabled={suspended}>
          <div>
            <strong>Disponibilité</strong>
            <span>{CAPACITY_LABEL[capacity] || 'Fermée'} — Ouverte · Occupée · Fermée</span>
          </div>
        </button>
      </div>

      <div className="profile-section-label">Établissement</div>
      <div className="nav-rows">
        <div className="nav-row nav-row--static">
          <div>
            <strong>{vendor?.canteenName || '—'}</strong>
            <span>Nom géré avec l’administration</span>
          </div>
        </div>
        <div className="nav-row nav-row--static">
          <div>
            <strong>{vendor?.campusName || '—'}</strong>
            <span>Campus</span>
          </div>
        </div>
        <div className="nav-row nav-row--static">
          <div>
            <strong>{vendor?.phone || '—'}</strong>
            <span>Téléphone du compte</span>
          </div>
        </div>
      </div>

      <div className="profile-section-label">Préférences</div>
      <div className="nav-rows">
        <button type="button" className="nav-row" onClick={onNotificationTap}>
          <div>
            <strong>Notifications</strong>
            <span>Commandes, retraits et alertes</span>
          </div>
        </button>
        <button type="button" className="nav-row" onClick={toggleSound}>
          <div>
            <strong>Son nouvelle commande</strong>
            <span>{soundMuted ? 'Coupé' : 'Activé'}</span>
          </div>
        </button>
      </div>

      <div className="profile-section-label">Compte</div>
      <div className="nav-rows">
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
            const ok = await confirm({
              title: 'Utiliser un autre compte',
              message:
                'Tu quittes ce compte sur cet appareil. Tu pourras te reconnecter avec ton numéro et ton code PIN.',
              confirmLabel: 'Quitter',
              danger: true,
            });
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
      </div>
    </div>
  );
}
