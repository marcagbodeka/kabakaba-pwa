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
