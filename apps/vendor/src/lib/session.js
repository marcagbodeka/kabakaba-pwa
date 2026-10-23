const KEY = 'kabakaba.vendor.session';
export const PIN_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const empty = {
  phone: null,
  pinConfigured: false,
  pinVerifiedAt: null,
  accessToken: null,
  refreshToken: null,
};

function persist(session) {
  const next = {
    phone: session.phone ?? null,
    pinConfigured: Boolean(session.pinConfigured),
    pinVerifiedAt: session.pinVerifiedAt ? Number(session.pinVerifiedAt) : null,
    accessToken: session.accessToken || null,
    refreshToken: session.refreshToken || null,
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function jwtExpMs(token) {
  if (!token || typeof token !== 'string') return 0;
  const parts = token.split('.');
  if (parts.length < 2) return 0;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function isPinSessionFresh(session = loadSession()) {
  const stamped = Number(session?.pinVerifiedAt);
  if (!stamped) return false;
  return Date.now() - stamped < PIN_SESSION_MS;
}

export function hasUsableRefresh(session = loadSession()) {
  return jwtExpMs(session?.refreshToken) > Date.now() + 2000;
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...empty };
    const parsed = JSON.parse(raw);
    return persist(parsed);
  } catch {
    return { ...empty };
  }
}

export function saveSession(patch) {
  return persist({ ...loadSession(), ...patch });
}

export function persistAuthTokens(payload) {
  if (!payload || typeof payload !== 'object') return loadSession();
  const patch = {};
  if (typeof payload.accessToken === 'string' && payload.accessToken) {
    patch.accessToken = payload.accessToken;
  }
  if (typeof payload.refreshToken === 'string' && payload.refreshToken) {
    patch.refreshToken = payload.refreshToken;
  }
  if (!Object.keys(patch).length) return loadSession();
  return saveSession(patch);
}

/** Oublie les JWT, garde le tampon PIN (on ne redemande pas le code au relance). */
export function clearAuthTokens() {
  const { phone, pinConfigured, pinVerifiedAt } = loadSession();
  return persist({ phone, pinConfigured, pinVerifiedAt });
}

/** Déconnexion volontaire : le prochain passage demande le PIN. */
export function clearTokens() {
  const { phone, pinConfigured } = loadSession();
  return persist({ phone, pinConfigured });
}

export function forgetDevice() {
  localStorage.removeItem(KEY);
  return { ...empty };
}
