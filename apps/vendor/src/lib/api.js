/**
 * Client API vendeur — routes CDC V1.3 accessibles au rôle VENDOR.
 */
import { clearTokens, loadSession, saveSession } from './session';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'https://kabakaba-backend.vercel.app/api/v1';

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
  return {
    ...v,
    balanceFcfa: Number(v.balanceFcfa ?? 0),
    pendingAmountTickets: Number(v.pendingAmountTickets ?? 0),
    pendingOrdersCount: Number(v.pendingOrdersCount ?? 0),
  };
}

let refreshPromise = null;

async function refreshAccessToken() {
  const { refreshToken } = loadSession();
  if (!refreshToken) throw new ApiError('Session expirée', 401);

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    clearTokens();
    throw new ApiError(extractMessage(data, 'Session expirée'), res.status);
  }
  saveSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? refreshToken,
  });
  return data.accessToken;
}

export async function api(path, { method = 'GET', body, auth = true, headers } = {}) {
  const opts = {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  if (auth) {
    const { accessToken } = loadSession();
    if (accessToken) opts.headers.Authorization = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${path}`, opts);

  if (res.status === 401 && auth) {
    refreshPromise =
      refreshPromise ||
      refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    try {
      const token = await refreshPromise;
      opts.headers.Authorization = `Bearer ${token}`;
      res = await fetch(`${API_BASE}${path}`, opts);
    } catch (err) {
      clearTokens();
      throw err;
    }
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(extractMessage(data, `Erreur ${res.status}`), res.status);
  }
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
  logout: () => api('/auth/logout', { method: 'POST', body: {} }),
};

export const vendorApi = {
  me: async () => normalizeVendor(await api('/vendors/me')),
  patchMe: async (body) => normalizeVendor(await api('/vendors/me', { method: 'PATCH', body })),
  sales: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/vendors/me/sales${q ? `?${q}` : ''}`);
  },
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

export const componentsApi = {
  manage: async (vendorId) =>
    unwrapList(await api(`/components/manage/${vendorId}`)),
  create: (body) => api('/components', { method: 'POST', body }),
  update: (id, body) => api(`/components/${id}`, { method: 'PATCH', body }),
  adjustStock: (id, delta) =>
    api(`/components/${id}/stock`, { method: 'PATCH', body: { delta } }),
  remove: (id) => api(`/components/${id}`, { method: 'DELETE' }),
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
};

export const notificationsApi = {
  list: async ({ page = 1, limit = 40 } = {}) => {
    const res = await api(`/notifications?page=${page}&limit=${limit}`);
    return { data: unwrapList(res), meta: res.meta };
  },
  markRead: (id) =>
    api(`/notifications/${id}`, { method: 'PATCH', body: { isRead: true } }),
};

export const ORDER_BUCKETS = {
  incoming: { label: 'Nouvelles', statuses: ['CONFIRMED'] },
  preparing: { label: 'Préparation', statuses: ['IN_PREPARATION'] },
  ready: { label: 'Prêtes', statuses: ['READY'] },
  history: { label: 'Historique', statuses: ['RECEIVED', 'CANCELLED'] },
};
