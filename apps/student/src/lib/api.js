/**
 * Client API étudiant — uniquement les routes backend CDC V1.3 accessibles
 * à un compte STUDENT (ou publiques). Aucune route legacy (menu-items,
 * packaging, transferts, ambassadeurs, etc.).
 */
import { clearSession, loadSession, saveSession } from './session';

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

/** Liste paginée `{ data, meta }` ou tableau brut → tableau. */
export function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    walletBalance: Number(user.walletBalance ?? 0),
    firstName: user.firstName || '',
    lastName: user.lastName || '',
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
    clearSession();
    throw new ApiError(extractMessage(data, 'Session expirée'), res.status);
  }
  saveSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? refreshToken,
  });
  return data.accessToken;
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const opts = {
    method,
    headers: { Accept: 'application/json' },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
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
      clearSession();
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

// --- Auth ---
export const authApi = {
  sendOtp: (phone) =>
    api('/auth/send-otp', { method: 'POST', auth: false, body: { phone } }),
  verifyOtp: (body) =>
    api('/auth/verify-otp', { method: 'POST', auth: false, body }),
  logout: () => api('/auth/logout', { method: 'POST', body: {} }),
};

// --- Profil ---
export const userApi = {
  me: async () => normalizeUser(await api('/users/me')),
  update: async (id, body) =>
    normalizeUser(await api(`/users/${id}`, { method: 'PATCH', body })),
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
};

export const paymentsApi = {
  preview: (amountFcfa) =>
    api('/payments/preview', { method: 'POST', body: { amountFcfa } }),
  /** @returns {{ id: string, amountFcfa: number, ticketsReceived: number, recap?: object }} */
  createIntent: async ({ amountFcfa, operator }) => {
    const res = await api('/payments/intent', {
      method: 'POST',
      body: { amountFcfa, operator },
    });
    const payment = res.payment || res;
    return {
      id: payment.id,
      amountFcfa: Number(payment.amountFcfa ?? res.recap?.amountFcfa ?? 0),
      ticketsReceived: Number(
        payment.ticketsReceived ?? res.recap?.ticketsReceived ?? 0,
      ),
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
};

export const reviewsApi = {
  create: (body) => api('/reviews', { method: 'POST', body }),
};

export const notificationsApi = {
  list: async () => unwrapList(await api('/notifications?page=1&limit=30')),
  markRead: (id) => api(`/notifications/${id}`, { method: 'PATCH', body: { isRead: true } }),
};
