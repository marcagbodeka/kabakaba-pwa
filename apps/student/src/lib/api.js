/**
 * Client API étudiant — uniquement les routes backend CDC V1.3 accessibles
 * à un compte STUDENT (ou publiques). Aucune route legacy (menu-items,
 * packaging, transferts, parrainage, etc.).
 */
import { clearTokens } from './session';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'https://kabakaba-backend.vercel.app/api/v1';

const APP = 'student';

export class ApiError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

function extractMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload.message === 'string') return payload.message;
  if (Array.isArray(payload.message)) return payload.message.join(' · ');
  return fallback;
}

/** Liste paginée `{ data, meta }` ou tableau brut → tableau. */
export function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export function normalizeUser(user) {
  if (!user) return null;
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  return {
    ...user,
    walletBalance: Number(user.walletBalance ?? 0),
    firstName,
    lastName,
    hasPin: Boolean(user.hasPin),
    profileComplete:
      typeof user.profileComplete === 'boolean'
        ? user.profileComplete
        : Boolean(firstName.trim() && lastName.trim()),
  };
}

let refreshPromise = null;
let csrfMemory = null;
/** Empêche la tempête csrf→refresh→401 quand les cookies sont morts. */
let sessionDead = false;

function rememberCsrf(data) {
  if (data && typeof data.csrfToken === 'string') csrfMemory = data.csrfToken;
}

function dropSession() {
  csrfMemory = null;
  sessionDead = true;
  clearTokens();
}

/** À appeler après un login / set-pin réussi. */
export function markSessionAlive() {
  sessionDead = false;
}

function csrfToken() {
  return csrfMemory;
}

function baseHeaders(method) {
  const headers = {
    Accept: 'application/json',
    'X-Kabakaba-App': APP,
  };
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = csrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  return headers;
}

async function ensureCsrf(force = false) {
  if (sessionDead) {
    throw new ApiError('Session expirée — reconnecte-toi', 401);
  }
  if (csrfMemory && !force) return csrfMemory;
  const res = await fetch(`${API_BASE}/auth/csrf`, {
    method: 'GET',
    credentials: 'include',
    headers: baseHeaders('GET'),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) dropSession();
    throw new ApiError(
      extractMessage(data, 'Session expirée — reconnecte-toi'),
      res.status,
    );
  }
  rememberCsrf(data);
  if (!csrfMemory) {
    throw new ApiError('Protection CSRF indisponible', 401);
  }
  return csrfMemory;
}

async function refreshAccessToken() {
  if (sessionDead) {
    throw new ApiError('Session expirée — reconnecte-toi', 401);
  }
  // Toujours relire le CSRF : un jeton en mémoire peut être périmé après rotation.
  await ensureCsrf(true);
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: baseHeaders('POST'),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = extractMessage(data, 'Session expirée');
    // Race de refresh concurrent : un autre appel a déjà tourné le cookie.
    // On retente une fois après un court délai au lieu de déconnecter.
    if (
      res.status === 401 &&
      /invalidée|déjà utilisé|reconnecter/i.test(msg)
    ) {
      await new Promise((r) => setTimeout(r, 450));
      try {
        await ensureCsrf(true);
        const retry = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: baseHeaders('POST'),
        });
        const retryData = await retry.json().catch(() => ({}));
        if (retry.ok) {
          sessionDead = false;
          rememberCsrf(retryData);
          return true;
        }
      } catch {
        /* fall through */
      }
    }
    dropSession();
    throw new ApiError(msg || 'Session expirée', res.status);
  }
  sessionDead = false;
  rememberCsrf(data);
  return true;
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: baseHeaders(method),
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  if (auth && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    await ensureCsrf();
    opts.headers = baseHeaders(method);
    if (body !== undefined) opts.headers['Content-Type'] = 'application/json';
  }

  let res = await fetch(`${API_BASE}${path}`, opts);

  if (res.status === 403 && auth && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    await ensureCsrf(true);
    opts.headers = baseHeaders(method);
    if (body !== undefined) opts.headers['Content-Type'] = 'application/json';
    res = await fetch(`${API_BASE}${path}`, opts);
  }

  if (res.status === 401 && auth) {
    if (sessionDead) {
      throw new ApiError('Session expirée — reconnecte-toi', 401);
    }
    refreshPromise =
      refreshPromise ||
      refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    try {
      await refreshPromise;
      opts.headers = baseHeaders(method);
      if (body !== undefined) opts.headers['Content-Type'] = 'application/json';
      res = await fetch(`${API_BASE}${path}`, opts);
    } catch (err) {
      throw err;
    }
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(extractMessage(data, `Erreur ${res.status}`), res.status);
  }
  rememberCsrf(data);
  return data;
}

/** POST multipart (avatar) — cookies + CSRF ; Cloudinary est géré côté backend. */
export async function apiUpload(path, file) {
  await ensureCsrf(true);
  const form = new FormData();
  form.append('file', file);

  const send = () =>
    fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders('POST'),
      body: form,
    });

  let res = await send();

  // CSRF périmé → relire le jeton et réessayer (sans déconnecter).
  if (res.status === 403) {
    await ensureCsrf(true);
    res = await send();
  }

  if (res.status === 401) {
    refreshPromise =
      refreshPromise ||
      refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    try {
      await refreshPromise;
      res = await send();
    } catch (err) {
      throw err;
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(extractMessage(data, `Erreur ${res.status}`), res.status);
  }
  rememberCsrf(data);
  return data;
}

// --- Auth ---
export const authApi = {
  sendOtp: (phone) =>
    api('/auth/send-otp', { method: 'POST', auth: false, body: { phone } }),
  verifyOtp: (body) =>
    api('/auth/verify-otp', { method: 'POST', auth: false, body }),
  setPin: (pinSetupToken, pin, identity) =>
    api('/auth/student/set-pin', {
      method: 'POST',
      auth: false,
      body: {
        pinSetupToken,
        pin,
        ...(identity?.firstName ? { firstName: identity.firstName } : {}),
        ...(identity?.lastName ? { lastName: identity.lastName } : {}),
      },
    }),
  loginPin: (phone, pin) =>
    api('/auth/student/login-pin', {
      method: 'POST',
      auth: false,
      body: { phone, pin },
    }),
  logout: async () => {
    try {
      return await api('/auth/logout', { method: 'POST', body: {} });
    } finally {
      dropSession();
    }
  },
};

// --- Profil ---
export const userApi = {
  me: async () => normalizeUser(await api('/users/me')),
  get: async (id) => normalizeUser(await api(`/users/${id}`)),
  update: async (id, body) =>
    normalizeUser(await api(`/users/${id}`, { method: 'PATCH', body })),
  uploadAvatar: async (file) => {
    const res = await apiUpload('/users/me/avatar', file);
    return res.avatarUrl || res.url;
  },
};

export const devicesApi = {
  register: (deviceToken) =>
    api('/devices', { method: 'POST', body: { deviceToken, platform: 'WEB' } }),
  unregister: (deviceToken) =>
    api(`/devices?deviceToken=${encodeURIComponent(deviceToken)}`, { method: 'DELETE' }),
};

export const referralsApi = {
  me: () => api('/referrals/me'),
};

// --- Public catalogue ---
export const campusApi = {
  list: async () => unwrapList(await api('/campuses?page=1&limit=100', { auth: false })),
  get: (id) => api(`/campuses/${id}`, { auth: false }),
};

export const vendorsApi = {
  list: async () => {
    const rows = unwrapList(await api('/vendors?page=1&limit=100', { auth: false }));
    return rows.filter((v) => v.isActive !== false);
  },
  get: (id) => api(`/vendors/${id}`, { auth: false }),
};

export const catalogApi = {
  categories: async (vendorId) =>
    unwrapList(await api(`/component-categories/${vendorId}`, { auth: false })),
  components: async (vendorId) =>
    unwrapList(await api(`/components/${vendorId}`, { auth: false })),
  menus: async (vendorId) =>
    unwrapList(await api(`/menus/${vendorId}`, { auth: false })),
  takeawayOptions: async (vendorId) => {
    const rows = unwrapList(
      await api(`/catalog/takeaway-options/${vendorId}?page=1&limit=50`, {
        auth: false,
      }),
    );
    return rows.filter((o) => o.isActive !== false && !o.deletedAt);
  },
};

// --- Commandes ---
export const ordersApi = {
  create: (body) => api('/orders', { method: 'POST', body }),
  list: async ({ page = 1, limit = 40, statuses } = {}) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statuses?.length) q.set('statuses', statuses.join(','));
    const res = await api(`/orders?${q}`);
    return {
      data: unwrapList(res),
      meta: res.meta || { page, limit, total: unwrapList(res).length },
    };
  },
  get: (id) => api(`/orders/${id}`),
  cancel: (id, reason) =>
    api(`/orders/${id}/cancel`, {
      method: 'POST',
      body: reason ? { reason } : {},
    }),
};

export const scheduledOrdersApi = {
  create: (body) => api('/scheduled-orders', { method: 'POST', body }),
  list: async ({ page = 1, limit = 20, status } = {}) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) q.set('status', status);
    const res = await api(`/scheduled-orders?${q}`);
    return { data: unwrapList(res), meta: res.meta };
  },
  get: (id) => api(`/scheduled-orders/${id}`),
  cancel: (id) => api(`/scheduled-orders/${id}/cancel`, { method: 'POST', body: {} }),
};

// --- Portefeuille ---
export const transactionsApi = {
  list: async ({ page = 1, limit = 30 } = {}) => {
    const res = await api(`/transactions?page=${page}&limit=${limit}`);
    return {
      data: unwrapList(res).map((t) => ({
        ...t,
        amount: Number(t.amount ?? 0),
      })),
      meta: res.meta,
    };
  },
  get: async (id) => {
    const t = await api(`/transactions/${id}`);
    return { ...t, amount: Number(t.amount ?? 0) };
  },
};

export const paymentsApi = {
  /** Preview : ticketsDesired (recommandé) ou amountFcfa. */
  preview: ({ ticketsDesired, amountFcfa } = {}) =>
    api('/payments/preview', {
      method: 'POST',
      body:
        ticketsDesired != null
          ? { ticketsDesired: Math.floor(Number(ticketsDesired)) }
          : { amountFcfa: Math.floor(Number(amountFcfa)) },
    }),
  /**
   * @param {{ ticketsReceived?: number, amountFcfa?: number, operator: string }} args
   * @returns {{ id: string, amountFcfa: number, ticketsReceived: number, feeFcfa: number, recap?: object }}
   */
  createIntent: async ({ ticketsReceived, amountFcfa, operator }) => {
    const body =
      ticketsReceived != null
        ? { ticketsReceived: Math.floor(Number(ticketsReceived)), operator }
        : { amountFcfa: Math.floor(Number(amountFcfa)), operator };
    const res = await api('/payments/intent', { method: 'POST', body });
    const payment = res.payment || res;
    return {
      id: payment.id,
      amountFcfa: Number(payment.amountFcfa ?? res.recap?.amountFcfa ?? 0),
      ticketsReceived: Number(
        payment.ticketsReceived ?? res.recap?.ticketsReceived ?? 0,
      ),
      feeFcfa: Number(res.recap?.feeFcfa ?? 0),
      status: payment.status,
      recap: res.recap,
      raw: res,
    };
  },
  initiate: (paymentId, phoneNumber) =>
    api(`/payments/${paymentId}/initiate`, {
      method: 'POST',
      body: { phoneNumber },
    }),
  list: async ({ page = 1, limit = 20 } = {}) => {
    const res = await api(`/payments?page=${page}&limit=${limit}`);
    return { data: unwrapList(res), meta: res.meta };
  },
  get: (id) => api(`/payments/${id}`),
};

// --- Signalements / avis (routes STUDENT actuelles) ---
export const reportsApi = {
  create: (body) => api('/reports', { method: 'POST', body }),
  list: async () => unwrapList(await api('/reports?page=1&limit=30')),
  get: (id) => api(`/reports/${id}`),
};

export const reviewsApi = {
  create: (body) => api('/reviews', { method: 'POST', body }),
  update: (id, body) => api(`/reviews/${id}`, { method: 'PATCH', body }),
};

export const notificationsApi = {
  list: async () => unwrapList(await api('/notifications?page=1&limit=30')),
  get: (id) => api(`/notifications/${id}`),
  markRead: (id) => api(`/notifications/${id}`, { method: 'PATCH', body: { isRead: true } }),
  welcome: () => api('/notifications/welcome', { method: 'POST', body: {} }),
};

export const partnerApplicationsApi = {
  create: (body) =>
    api('/partner-applications', { method: 'POST', auth: false, body }),
};
