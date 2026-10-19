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
import { devicesApi, notificationsApi } from './api';

const WELCOME_SENT_KEY = 'kabakaba_vendor_welcome_sent';

const FALLBACK_FIREBASE = {
  apiKey: 'AIzaSyAMqcb5tHNtKJ-Jt8nzUnHzrErUk6dSRDA',
  authDomain: 'kabakaba-43a55.firebaseapp.com',
  projectId: 'kabakaba-43a55',
  messagingSenderId: '234320774252',
  appId: '1:234320774252:web:968f07cafb2a0d7ff60449',
};
const FALLBACK_VAPID = 'BP6s6SvJb1t4G1tWD_eWXdakb6aArlfvEDPdBEw1PamAjD6-QXmJst8mtM6-g4VKiOi4tYHQFfGoX2-6RyG2R1s';

let registeredToken = null;
let foregroundBound = false;

function firebaseConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || FALLBACK_FIREBASE.apiKey;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || FALLBACK_FIREBASE.authDomain;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || FALLBACK_FIREBASE.projectId;
  const messagingSenderId =
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || FALLBACK_FIREBASE.messagingSenderId;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID || FALLBACK_FIREBASE.appId;
  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    return null;
  }
  return { apiKey, authDomain, projectId, messagingSenderId, appId };
}

function getVapidKey() {
  return import.meta.env.VITE_FIREBASE_VAPID_KEY || FALLBACK_VAPID || null;
}

export function isWebPushConfigured() {
  return Boolean(firebaseConfig() && getVapidKey());
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
    if (localStorage.getItem('kaba_vendor_order_sounds_muted') === '1') return;
    const urgent = kind === 'NEW_ORDER' || kind === 'ORDER_RING' || kind === 'order_ring';
    const audio = new Audio('/sounds/new-order.wav');
    audio.volume = urgent ? 1 : 0.75;
    void audio.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

function showLocalNotification(title, body, kind) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }
  // Si l’onglet est focus, Chrome masque souvent la bannière OS —
  // PushHeadsUp affiche alors le slide-in. On tente quand même le SW.
  const opts = {
    body,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: kind || 'kabakaba-vendor',
    renotify: true,
  };
  try {
    if (navigator.serviceWorker?.ready) {
      void navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, opts));
      return;
    }
    const n = new Notification(title, opts);
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
    const kind = data.kind || data.channel || '';
    if (!title && !body) return;
    if (
      kind === 'NEW_ORDER' ||
      kind === 'ORDER_RING' ||
      kind === 'order_ring' ||
      String(kind).startsWith('ORDER_')
    ) {
      playOrderCue(kind);
    }
    showLocalNotification(title || 'Nouvelle commande', body || '', kind);
    window.dispatchEvent(
      new CustomEvent('kabakaba:push', { detail: { kind, title, body, data } }),
    );
  });
}

/**
 * @param {{ forcePrompt?: boolean, welcome?: boolean }} [options]
 * forcePrompt=true uniquement depuis un clic utilisateur (sinon Chrome ignore la popup).
 * welcome=true envoie POST /notifications/welcome après enregistrement du device (1× / session).
 */
export async function registerWebPush(options = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  const config = firebaseConfig();
  const vapidKey = getVapidKey();
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
    await bindForeground(messaging);
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    if (token !== registeredToken) {
      registeredToken = token;
      await devicesApi.register(token);
      console.info('KABA_PUSH: token enregistré', `${token.slice(0, 12)}…`);
    } else if (options.welcome) {
      await devicesApi.register(token);
    }

    if (options.welcome) {
      try {
        if (sessionStorage.getItem(WELCOME_SENT_KEY) !== '1') {
          sessionStorage.setItem(WELCOME_SENT_KEY, '1');
          const res = await notificationsApi.welcome();
          console.info('KABA_PUSH: bienvenue envoyée', res?.fcm);
          // Secours local si FCM n’affiche rien (onglet focus / délai SW).
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification('Bienvenue sur kabakaba', {
            body:
              res?.hint?.includes('push') || res?.fcm?.successCount
                ? 'Les alertes de commandes sont actives.'
                : 'Notifications activées sur cet appareil.',
            icon: '/pwa-192.png',
            badge: '/pwa-192.png',
            tag: 'WELCOME',
            renotify: true,
          });
        }
      } catch (err) {
        try {
          sessionStorage.removeItem(WELCOME_SENT_KEY);
        } catch {
          /* ignore */
        }
        console.warn('KABA_PUSH: bienvenue ignorée', err);
      }
    }

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
