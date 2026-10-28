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

function formatPhone(phone) {
  if (!phone) return 'Non renseigné';
  const digits = String(phone).replace(/\D/g, '');
  const local = digits.startsWith('228') ? digits.slice(3) : digits;
  const groups = local.match(/.{1,2}/g)?.join(' ') || phone;
  return digits.startsWith('228') ? `+228 ${groups}` : groups;
}

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
        showCapacity={false}
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

      <div className="profile-section-label">Vitrine</div>
      <div className="profile-media">
        <button
          type="button"
          className="profile-media-tile"
          disabled={uploading === 'logo' || suspended}
          onClick={() => logoRef.current?.click()}
        >
          <span className="profile-media-frame profile-media-frame--logo">
            {vendor?.logoUrl ? (
              <img src={vendor.logoUrl} alt="" />
            ) : (
              <span className="profile-media-fallback">{initials}</span>
            )}
          </span>
          <span className="profile-media-meta">
            <strong>Logo</strong>
            <em>{uploading === 'logo' ? 'Envoi…' : 'Modifier'}</em>
          </span>
        </button>
        <button
          type="button"
          className="profile-media-tile"
          disabled={uploading === 'banner' || suspended}
          onClick={() => bannerRef.current?.click()}
        >
          <span className="profile-media-frame">
            {vendor?.bannerUrl ? (
              <img src={vendor.bannerUrl} alt="" />
            ) : (
              <span className="profile-media-fallback profile-media-fallback--empty">Aucune</span>
            )}
          </span>
          <span className="profile-media-meta">
            <strong>Bannière</strong>
            <em>{uploading === 'banner' ? 'Envoi…' : 'Modifier'}</em>
          </span>
        </button>
      </div>
      <p className="profile-media-note">Images de la fiche que les étudiants voient.</p>
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

      <div className="profile-section-label">Cantine</div>
      <div className="nav-rows">
        {editing ? (
          <div className="profile-edit">
            <div className="vfield">
              <label htmlFor="canteen-name">Nom</label>
              <input
                id="canteen-name"
                value={canteenName}
                onChange={(e) => setCanteenName(e.target.value)}
              />
            </div>
            <div className="vfield">
              <label htmlFor="canteen-description">Description</label>
              <input
                id="canteen-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="profile-edit-actions">
              <button
                type="button"
                className="btn-action outline"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn-action fill primary"
                disabled={busy || !canteenName.trim() || suspended}
                onClick={save}
              >
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="nav-row"
            disabled={suspended}
            onClick={() => {
              setCanteenName(vendor?.canteenName || '');
              setDescription(vendor?.description || '');
              setEditing(true);
            }}
          >
            <div>
              <strong>Présentation</strong>
              <span>
                {vendor?.description?.trim() || 'Ajoute une courte présentation.'}
              </span>
            </div>
          </button>
        )}
        <div className="nav-row nav-row--static">
          <div>
            <strong>Téléphone</strong>
            <span>{formatPhone(vendor?.phone)}</span>
          </div>
        </div>
        <button type="button" className="nav-row" onClick={onOpenCatalog} disabled={suspended}>
          <div>
            <strong>Carte</strong>
            <span>Plat de base, en plus, menus fixés</span>
          </div>
        </button>
        <button type="button" className="nav-row" onClick={onCapacityTap} disabled={suspended}>
          <div>
            <strong>Disponibilité</strong>
            <span>{CAPACITY_LABEL[capacity] || 'Fermée'}</span>
          </div>
        </button>
      </div>

      <div className="profile-section-label" id="push-settings">Alertes</div>
      <div className="nav-rows">
        {pushPerm === 'denied' ? (
          <button
            type="button"
            className="nav-row"
            onClick={() => showSnack?.(getPushBlockedHelp())}
          >
            <div>
              <strong>Alertes de commandes</strong>
              <span>Bloquées dans le navigateur. Appuie pour les autoriser.</span>
            </div>
          </button>
        ) : (
          <label className="nav-row nav-row--switch">
            <div>
              <strong>Alertes de commandes</strong>
              <span>
                {pushBusy
                  ? 'Activation en cours…'
                  : !isWebPushConfigured()
                    ? 'Indisponibles sur ce déploiement.'
                    : pushOn
                      ? 'Activées sur cet appareil.'
                      : 'Reçois un signal à chaque nouvelle commande.'}
              </span>
            </div>
            <input
              className="setting-switch"
              type="checkbox"
              checked={pushOn}
              disabled={pushBusy || pushOn || !isWebPushConfigured()}
              onChange={async (e) => {
                if (!e.target.checked) return;
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
                    showSnack?.(
                      perm === 'denied'
                        ? getPushBlockedHelp()
                        : 'Accepte la demande du navigateur pour activer',
                    );
                  }
                } finally {
                  setPushBusy(false);
                }
              }}
            />
          </label>
        )}
        <label className="nav-row nav-row--switch">
          <div>
            <strong>Son nouvelle commande</strong>
            <span>{soundMuted ? 'Coupé' : 'Activé'}</span>
          </div>
          <input
            className="setting-switch"
            type="checkbox"
            checked={!soundMuted}
            onChange={toggleSound}
          />
        </label>
      </div>

      <div className="profile-section-label">Compte</div>
      <div className="nav-rows">
        <button type="button" className="nav-row" onClick={() => auth.logout()}>
          <div>
            <strong>Se déconnecter</strong>
            <span>Revenir à l’écran du code PIN</span>
          </div>
        </button>
        <button
          type="button"
          className="nav-row nav-row--danger"
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
            <span>Oublier cet appareil</span>
          </div>
        </button>
      </div>
      </div>
      </div>
    </div>
  );
}
