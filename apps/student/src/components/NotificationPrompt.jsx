import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getNotificationPermission,
  isWebPushConfigured,
  registerWebPush,
} from '../lib/push';

const DISMISS_KEY = 'kabakaba_student_push_later';

/**
 * Bannière sticky (pas une modal) : Chrome exige un clic pour requestPermission,
 * et la modal « Épingler l’app » ne doit plus masquer cette demande.
 */
export default function NotificationPrompt({ showSnack }) {
  const auth = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [misconfigured, setMisconfigured] = useState(false);

  useEffect(() => {
    if (!auth.ready || !auth.authenticated) {
      setVisible(false);
      return;
    }
    if (!('Notification' in window)) {
      setVisible(false);
      return;
    }

    const configured = isWebPushConfigured();
    setMisconfigured(!configured);

    const perm = getNotificationPermission();
    if (perm === 'granted') {
      if (configured) registerWebPush().catch(() => {});
      setVisible(false);
      return;
    }

    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1' && perm !== 'denied') {
        setVisible(false);
        return;
      }
    } catch {
      /* ignore */
    }

    setBlocked(perm === 'denied');
    // Toujours afficher si pas encore granted — même sans config (message d’erreur).
    setVisible(true);
  }, [auth.ready, auth.authenticated]);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const enable = async () => {
    if (misconfigured) {
      showSnack?.(
        'Push non configuré sur ce déploiement (variables VITE_FIREBASE_* / VAPID)',
      );
      return;
    }
    setBusy(true);
    try {
      const token = await registerWebPush({ forcePrompt: true });
      if (token) {
        setVisible(false);
        try {
          sessionStorage.removeItem(DISMISS_KEY);
        } catch {
          /* ignore */
        }
        showSnack?.('Notifications activées', 'success');
        return;
      }
      const perm = getNotificationPermission();
      if (perm === 'denied') {
        setBlocked(true);
        showSnack?.('Notifications bloquées dans le navigateur');
      } else if (perm === 'default') {
        showSnack?.('Tu dois accepter la popup du navigateur');
      } else {
        showSnack?.('Impossible d’activer les notifications pour l’instant');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="push-banner" role="region" aria-label="Activer les notifications">
      <div className="push-banner-inner">
        <div className="push-banner-text">
          <strong>Activer les notifications</strong>
          <span>
            {misconfigured
              ? 'Config Firebase manquante sur ce déploiement.'
              : blocked
                ? 'Bloquées dans le navigateur — autorise kabakaba dans les réglages du site.'
                : 'Sois alerté quand ta commande est prête.'}
          </span>
        </div>
        <div className="push-banner-actions">
          {!blocked ? (
            <button type="button" className="btn-fill push-banner-btn" disabled={busy} onClick={enable}>
              {busy ? '…' : 'Autoriser'}
            </button>
          ) : null}
          <button type="button" className="link-btn push-banner-later" onClick={dismiss}>
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
