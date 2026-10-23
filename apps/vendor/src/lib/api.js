/**
 * Client API vendeur — routes CDC V1.3 accessibles au rôle VENDOR.
 */
import { clearTokens } from './session';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'https://kabakaba-backend.vercel.app/api/v1';

const APP = 'vendor';

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

export function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export function normalizeVendor(v) {
  if (!v) return null;
  const campuses = Array.isArray(v.campuses) ? v.campuses : [];
  const campusName =
    v.campusName || campuses[0]?.name || campuses[0]?.campus?.name || '';
  const balanceFcfa = Number(v.balanceFcfa ?? 0);
  const isActive = v.isActive !== false;
  const phone = v.phone || v.user?.phone || null;
  return {
    ...v,
    campuses,
    campusName,
    phone,
    balanceFcfa,
    pendingAmountTickets: Number(v.pendingAmountTickets ?? 0),
    pendingOrdersCount: Number(v.pendingOrdersCount ?? 0),
    isActive,
    suspendedAt: v.suspendedAt || null,
    suspensionReason: v.suspensionReason || null,
    canWithdraw: Boolean(v.canWithdraw ?? (isActive && balanceFcfa > 0)),
  };
}

let refreshPromise = null;
let csrfMemory = null;
/** Empêche la tempête csrf→refresh→401 quand les cookies sont morts. */
let sessionDead = false;
/** Pause refresh après un 429 pour éviter de tuer / spam le token. */
let refreshBackoffUntil = 0;

function rememberCsrf(data) {
  if (data && typeof data.csrfToken === 'string') csrfMemory = data.csrfToken;
}

function dropSession() {
  csrfMemory = null;
  sessionDead = true;
  clearTokens();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kaba:session-expired'));
  }
}

/** À appeler après login PIN / set-pin réussi. */
export function markSessionAlive() {
  sessionDead = false;
  refreshBackoffUntil = 0;
}

export function isSessionDead() {
  return sessionDead;
}

function csrfToken() {
  return csrfMemory;
}

function baseHeaders(method, extra) {
  const headers = {
    Accept: 'application/json',
    'X-Kabakaba-App': APP,
    ...extra,
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
    throw new ApiError(
      extractMessage(data, 'Impossible de relire la session'),
      res.status,
    );
  }
  rememberCsrf(data);
  return csrfMemory;
}

async function refreshAccessToken() {
  if (sessionDead) {
    throw new ApiError('Session expirée — reconnecte-toi', 401);
  }
  if (Date.now() < refreshBackoffUntil) {
    throw new ApiError('Trop de requêtes — réessaie dans un instant', 429);
  }
  await ensureCsrf(true);
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: baseHeaders('POST'),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = extractMessage(data, 'Session expirée');
    // Throttle / panne serveur : ne pas tuer la session (sinon "expire vite").
    if (res.status === 429 || res.status >= 500) {
      if (res.status === 429) {
        refreshBackoffUntil = Date.now() + 60_000;
      }
      throw new ApiError(
        res.status === 429
          ? 'Trop de requêtes — réessaie dans un instant'
          : msg || 'Serveur indisponible',
        res.status,
      );
    }
    // Race refresh concurrent : retenter une fois avant de couper.
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
    // Couper uniquement sur échec d’auth définitif.
    if (res.status === 401 || res.status === 403) {
      dropSession();
    }
    throw new ApiError(msg || 'Session expirée', res.status);
  }
  sessionDead = false;
  rememberCsrf(data);
  return true;
}

export async function api(path, { method = 'GET', body, auth = true, headers } = {}) {
  const build = () => {
    const next = {
      method,
      credentials: 'include',
      headers: baseHeaders(method, headers),
    };
    if (body !== undefined) {
      next.headers['Content-Type'] = 'application/json';
      next.body = JSON.stringify(body);
    }
    return next;
  };

  if (auth && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    await ensureCsrf();
  }

  let res = await fetch(`${API_BASE}${path}`, build());

  if (
    res.status === 403 &&
    auth &&
    !['GET', 'HEAD', 'OPTIONS'].includes(method)
  ) {
    await ensureCsrf(true);
    res = await fetch(`${API_BASE}${path}`, build());
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
      res = await fetch(`${API_BASE}${path}`, build());
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

/** POST multipart (logo / bannière) avec cookies + CSRF comme `api`. */
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

  if (res.status === 403) {
    await ensureCsrf(true);
    res = await send();
  }

  if (res.status === 401) {
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

export const vendorAuthApi = {
  activateStart: (phone, password) =>
    api('/auth/vendor/activate/start', {
      method: 'POST',
      auth: false,
      body: { phone, password },
    }),
  resendOtp: (onboardingToken) =>
    api('/auth/vendor/activate/resend-otp', {
      method: 'POST',
      auth: false,
      body: { onboardingToken },
    }),
  verifyOtp: (onboardingToken, code) =>
    api('/auth/vendor/activate/verify-otp', {
      method: 'POST',
      auth: false,
      body: { onboardingToken, code },
    }),
  setPin: (pinSetupToken, pin) =>
    api('/auth/vendor/activate/set-pin', {
      method: 'POST',
      auth: false,
      body: { pinSetupToken, pin },
    }),
  loginPin: (phone, pin) =>
    api('/auth/vendor/login-pin', {
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

export const vendorApi = {
  me: async () => normalizeVendor(await api('/vendors/me')),
  patchMe: async (body) => normalizeVendor(await api('/vendors/me', { method: 'PATCH', body })),
  sales: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/vendors/me/sales${q ? `?${q}` : ''}`);
  },
  update: async (id, body) => normalizeVendor(await api(`/vendors/${id}`, { method: 'PATCH', body })),
};

export const ordersApi = {
  list: async ({ page = 1, limit = 20, statuses } = {}) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statuses?.length) q.set('statuses', statuses.join(','));
    const res = await api(`/orders?${q}`);
    return { data: unwrapList(res), meta: res.meta };
  },
  get: (id) => api(`/orders/${id}`),
  updateStatus: (id, status) =>
    api(`/orders/${id}`, { method: 'PATCH', body: { status } }),
  cancel: (id, reason) =>
    api(`/orders/${id}/cancel`, { method: 'POST', body: { reason } }),
};

export const categoriesApi = {
  list: async (vendorId) => unwrapList(await api(`/component-categories/${vendorId}`)),
  create: (body) => api('/component-categories', { method: 'POST', body }),
  update: (id, body) => api(`/component-categories/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/component-categories/${id}`, { method: 'DELETE' }),
};

export const componentsApi = {
  manage: async (vendorId) =>
    unwrapList(await api(`/components/manage/${vendorId}`)),
  create: (body) => api('/components', { method: 'POST', body }),
  update: (id, body) => api(`/components/${id}`, { method: 'PATCH', body }),
  adjustStock: (id, delta) =>
    api(`/components/${id}/stock`, { method: 'PATCH', body: { delta } }),
  remove: (id) => api(`/components/${id}`, { method: 'DELETE' }),
};

export const mediaApi = {
  uploadLogo: (file) => apiUpload('/vendors/me/logo', file),
  uploadBanner: (file) => apiUpload('/vendors/me/banner', file),
};

export const devicesApi = {
  register: (deviceToken) =>
    api('/devices', { method: 'POST', body: { deviceToken, platform: 'WEB' } }),
  unregister: (deviceToken) =>
    api(`/devices?deviceToken=${encodeURIComponent(deviceToken)}`, { method: 'DELETE' }),
};

export const menusApi = {
  manage: async (vendorId) =>
    unwrapList(await api(`/menus/manage/${vendorId}`)),
  create: (body) => api('/menus', { method: 'POST', body }),
  update: (id, body) => api(`/menus/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/menus/${id}`, { method: 'DELETE' }),
};

export const takeawayApi = {
  manage: async (vendorId, { page = 1, limit = 50 } = {}) => {
    const res = await api(
      `/catalog/takeaway-options/manage/${vendorId}?page=${page}&limit=${limit}`,
    );
    return unwrapList(res);
  },
  create: (body) =>
    api('/catalog/takeaway-options', { method: 'POST', body }),
  update: (id, body) =>
    api(`/catalog/takeaway-options/${id}`, { method: 'PATCH', body }),
  remove: (id) =>
    api(`/catalog/takeaway-options/${id}`, { method: 'DELETE' }),
};

export const withdrawalsApi = {
  preview: (amount, operator) =>
    api('/withdrawals/preview', {
      method: 'POST',
      body: { amount: Number(amount), operator },
    }),
  request: (amount, operator) =>
    api('/withdrawals', {
      method: 'POST',
      body: { amount: Number(amount), operator },
    }),
  mine: async ({ page = 1, limit = 20 } = {}) => {
    const res = await api(`/withdrawals/me?page=${page}&limit=${limit}`);
    return { data: unwrapList(res), meta: res.meta };
  },
};

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

export const notificationsApi = {
  list: async ({ page = 1, limit = 40 } = {}) => {
    const res = await api(`/notifications?page=${page}&limit=${limit}`);
    return { data: unwrapList(res), meta: res.meta };
  },
  get: (id) => api(`/notifications/${id}`),
  markRead: (id) =>
    api(`/notifications/${id}`, { method: 'PATCH', body: { isRead: true } }),
  welcome: () => api('/notifications/welcome', { method: 'POST', body: {} }),
};

export const ORDER_BUCKETS = {
  incoming: { label: 'Confirmées', statuses: ['CONFIRMED'] },
  preparing: { label: 'Préparation', statuses: ['IN_PREPARATION'] },
  ready: { label: 'Prêtes', statuses: ['READY'] },
  history: { label: 'Historique', statuses: ['RECEIVED', 'CANCELLED'] },
};
