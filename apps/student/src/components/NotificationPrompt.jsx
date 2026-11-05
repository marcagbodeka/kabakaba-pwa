import { useEffect, useLayoutEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getNotificationPermission,
  isWebPushConfigured,
  registerWebPush,
} from '../lib/push';

const DISMISS_KEY = 'kabakaba_student_push_later';

export default function NotificationPrompt({ showSnack }) {
  const auth = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [misconfigured, setMisconfigured] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);

  useLayoutEffect(() => {
    const read = () => document.body.classList.contains('consent-install-open');
    setInstallOpen(read());
    const obs = new MutationObserver(() => setInstallOpen(read()));
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

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

    setBlocked(perm === 'denied');
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
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
      showSnack?.('Les notifications ne sont pas encore configurées sur ce déploiement.');
      return;
    }
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        /* le navigateur peut ignorer l’appel */
      }
    }
    if (Notification.permission !== 'granted') {
      setBlocked(Notification.permission === 'denied');
      showSnack?.(
        Notification.permission === 'denied'
          ? 'Notifications bloquées dans le navigateur'
          : 'Tu dois accepter la demande du navigateur',
      );
      return;
    }
    setBusy(true);
    try {
      const token = await registerWebPush();
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

  if (!visible || installOpen) return null;

  const message = misconfigured
    ? 'Les notifications ne sont pas encore configurées sur ce déploiement.'
    : blocked
      ? 'Les notifications sont bloquées dans le navigateur. Autorise kabakaba dans les réglages du site.'
      : 'Nous vous tenons informés de l’état de vos commandes, ainsi que des offres.';

  return (
    <div className="consent-backdrop" role="dialog" aria-modal="true" aria-labelledby="push-title">
      <div className="consent-sheet">
        <h2 id="push-title">Autorisez kabakaba à vous envoyer des notifications</h2>
        <p>{message}</p>
        <div className="consent-actions">
          {!blocked ? (
            <button type="button" className="consent-allow" disabled={busy} onClick={enable}>
              {busy ? 'Ouverture…' : 'Autoriser'}
            </button>
          ) : null}
          <button type="button" className="consent-deny" onClick={dismiss}>
            Refuser
          </button>
        </div>
      </div>
    </div>
  );
}
