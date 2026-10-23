const KEY = 'kabakaba.student.session';
export const PIN_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const empty = {
  phone: null,
  pinConfigured: false,
  pinVerifiedAt: null,
};

function persist(session) {
  const next = {
    phone: session.phone ?? null,
    pinConfigured: Boolean(session.pinConfigured),
    pinVerifiedAt: session.pinVerifiedAt ? Number(session.pinVerifiedAt) : null,
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function isPinSessionFresh(session = loadSession()) {
  const stamped = Number(session?.pinVerifiedAt);
  if (!stamped) return false;
  return Date.now() - stamped < PIN_SESSION_MS;
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
