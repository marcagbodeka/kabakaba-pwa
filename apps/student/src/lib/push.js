/**
 * Push web (FCM) — sans effet si la config Firebase n’est pas définie.
 *
 * Variables Vite :
 * - VITE_FIREBASE_API_KEY
 * - VITE_FIREBASE_AUTH_DOMAIN
 * - VITE_FIREBASE_PROJECT_ID
 * - VITE_FIREBASE_MESSAGING_SENDER_ID
 * - VITE_FIREBASE_APP_ID
 * - VITE_FIREBASE_VAPID_KEY
 */
import { devicesApi } from './api';

let registeredToken = null;
let foregroundBound = false;

function firebaseConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    return null;
  }
  return { apiKey, authDomain, projectId, messagingSenderId, appId };
}

export function isWebPushConfigured() {
  return Boolean(firebaseConfig() && import.meta.env.VITE_FIREBASE_VAPID_KEY);
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** Texte d’aide quand le navigateur a déjà refusé (requestPermission ne repoppe plus). */
export function getPushBlockedHelp() {
  return 'Clique le cadenas à gauche de l’URL → Notifications → Autoriser, puis recharge la page.';
}

function playOrderCue(kind) {
  try {
    const urgent = kind === 'ORDER_READY' || kind === 'NEW_ORDER';
    const audio = new Audio('/sounds/order-ready.wav');
    audio.volume = urgent ? 1 : 0.7;
    void audio.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

function showLocalNotification(title, body, kind) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }
  try {
    const n = new Notification(title, {
      body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: kind || 'kabakaba',
      renotify: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

async function bindForeground(messaging) {
  if (foregroundBound) return;
  foregroundBound = true;
  const { onMessage } = await import('firebase/messaging');
  onMessage(messaging, (payload) => {
    const data = payload?.data || {};
    const title = payload?.notification?.title || data.title;
    const body = payload?.notification?.body || data.body;
    const kind = data.kind || '';
    if (!title && !body) return;
    if (kind.startsWith('ORDER_') || kind === 'NEW_ORDER') {
      playOrderCue(kind);
    }
    showLocalNotification(title || 'kabakaba', body || '', kind);
    window.dispatchEvent(
      new CustomEvent('kabakaba:push', { detail: { kind, title, body, data } }),
    );
  });
}

/**
 * @param {{ forcePrompt?: boolean }} [options]
 * forcePrompt=true uniquement depuis un clic utilisateur (sinon Chrome ignore la popup).
 */
export async function registerWebPush(options = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  const config = firebaseConfig();
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!config || !vapidKey) {
    console.warn('KABA_PUSH: config Firebase / VAPID manquante au build');
    return null;
  }

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) {
      console.warn('KABA_PUSH: messaging non supporté sur ce navigateur');
      return null;
    }

    if (Notification.permission === 'default') {
      // Sans geste utilisateur, beaucoup de navigateurs n’affichent plus la popup.
      if (!options.forcePrompt) {
        console.info('KABA_PUSH: permission default — attendre un clic « Autoriser »');
        return null;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return null;
    } else if (Notification.permission !== 'granted') {
      console.warn('KABA_PUSH: permission=', Notification.permission);
      return null;
    }

    const app = getApps().length ? getApps()[0] : initializeApp(config);
    const messaging = getMessaging(app);
    await bindForeground(messaging);
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token || token === registeredToken) return token;

    registeredToken = token;
    await devicesApi.register(token);
    console.info('KABA_PUSH: token enregistré', `${token.slice(0, 12)}…`);
    return token;
  } catch (err) {
    console.warn('KABA_PUSH: enregistrement ignoré', err);
    registeredToken = null;
    return null;
  }
}

export async function unregisterWebPush() {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await devicesApi.unregister(token);
  } catch {
    /* ignore */
  }
}
