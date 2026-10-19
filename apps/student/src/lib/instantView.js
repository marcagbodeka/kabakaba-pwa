/**
 * Dernier écran connu, peint avant le réseau.
 * Au-delà d'environ 400 ms, un écran vide est perçu comme lent :
 * on réaffiche tout de suite les données déjà vues, puis on les rafraîchit.
 */
const PREFIX = 'kabakaba.student.view.';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export function readView(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - Number(parsed.at) > MAX_AGE_MS) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export function writeView(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota pleine : l'écran reste servi par le réseau */
  }
}

export function clearViews() {
  try {
    const drop = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) drop.push(k);
    }
    drop.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
