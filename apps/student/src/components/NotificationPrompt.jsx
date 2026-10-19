import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getNotificationPermission,
  isWebPushConfigured,
  registerWebPush,
} from '../lib/push';

const DISMISS_KEY = 'kabakaba_student_push_later';

/**
 * Chrome / Android bloquent souvent requestPermission() sans geste utilisateur.
 * On affiche donc une carte « Activer » après connexion.
 */
export default function NotificationPrompt({ showSnack }) {
  const auth = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!auth.ready || !auth.authenticated) {
      setVisible(false);
      return;
    }
    if (!isWebPushConfigured()) {
      setVisible(false);
      return;
    }
    if (!('Notification' in window)) {
      setVisible(false);
      return;
    }

    const perm = getNotificationPermission();
    if (perm === 'granted') {
      // Déjà autorisé : (re)sync token sans UI.
      registerWebPush().catch(() => {});
      setVisible(false);
      return;
    }
    if (perm === 'denied') {
      setBlocked(true);
      setVisible(true);
      return;
    }

    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') {
        setVisible(false);
        return;
      }
    } catch {
      /* ignore */
    }

    setBlocked(false);
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
    setBusy(true);
    try {
      const token = await registerWebPush({ forcePrompt: true });
      if (token) {
        setVisible(false);
        showSnack?.('Notifications activées', 'success');
        return;
      }
      const perm = getNotificationPermission();
      if (perm === 'denied') {
        setBlocked(true);
        showSnack?.('Notifications bloquées dans le navigateur');
      } else {
        showSnack?.('Impossible d’activer les notifications pour l’instant');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="install-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-title"
    >
      <div className="install-sheet">
        <div className="push-prompt-icon" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <h2 id="push-title">Activer les notifications</h2>
        {blocked ? (
          <p>
            Les notifications sont <strong>bloquées</strong> pour ce site. Ouvre les
            paramètres du navigateur → Notifications → autorise kabakaba, puis
            réessaie.
          </p>
        ) : (
          <p>
            Reçois une alerte quand ta commande est confirmée, en préparation ou
            prête à récupérer.
          </p>
        )}
        <div className="install-actions">
          {!blocked ? (
            <button type="button" className="btn-fill" disabled={busy} onClick={enable}>
              {busy ? 'Activation…' : 'Autoriser les notifications'}
            </button>
          ) : null}
          <button type="button" className="link-btn" onClick={dismiss}>
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
