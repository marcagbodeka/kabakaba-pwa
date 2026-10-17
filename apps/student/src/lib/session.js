const KEY = 'kabakaba.student.session';

const empty = {
  phone: null,
  pinConfigured: false,
};

function persist(session) {
  const next = {
    phone: session.phone ?? null,
    pinConfigured: Boolean(session.pinConfigured),
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
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

export function clearTokens() {
  const { phone, pinConfigured } = loadSession();
  return persist({ phone, pinConfigured });
}

export function forgetDevice() {
  localStorage.removeItem(KEY);
  return { ...empty };
}

export function clearSession() {
  return forgetDevice();
}
