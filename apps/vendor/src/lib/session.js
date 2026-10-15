const KEY = 'kabakaba.vendor.session';

const empty = {
  accessToken: null,
  refreshToken: null,
  phone: null,
  pinConfigured: false,
};

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...empty };
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return { ...empty };
  }
}

export function saveSession(patch) {
  const next = { ...loadSession(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearTokens() {
  return saveSession({ accessToken: null, refreshToken: null });
}

export function forgetDevice() {
  localStorage.removeItem(KEY);
  return { ...empty };
}

export function hasTokens(session = loadSession()) {
  return Boolean(session.accessToken && session.refreshToken);
}
