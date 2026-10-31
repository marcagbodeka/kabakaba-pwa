/** Même vocabulaire que la PWA vendeur et que le contrôle de commande. */
export const PLATE = {
  base: 'Plat de base',
  extra: 'En plus',
  choice: 'Au choix',
  always: 'Toujours mis',
  drink: 'Jus & Boissons',
};

const BY_NAME = {
  [PLATE.base]: 'base',
  [PLATE.extra]: 'extra',
  [PLATE.choice]: 'choice',
  [PLATE.always]: 'always',
  [PLATE.drink]: 'drink',
};

export function roleOfComponent(component, categories) {
  const cat = (categories || []).find((c) => c.id === component?.categoryId);
  return BY_NAME[cat?.name] || 'other';
}

export function groupPlate(components, categories) {
  const groups = { base: [], extra: [], choice: [], always: [], drink: [], other: [] };
  for (const component of components || []) {
    groups[roleOfComponent(component, categories)].push(component);
  }
  return groups;
}

/**
 * Un extra ou une sauce exige un plat de base, sauf si un menu est déjà dans
 * la commande. Les lignes anciennes sans `role` s’appuient sur `soldAlone`.
 */
export function missingBaseMessage(order) {
  const lines = (order?.plates || []).flatMap((plate) => plate.lines || []);
  const needsBase = lines.some(
    (line) =>
      !line.menuId &&
      (line.role === 'extra' ||
        line.role === 'sauce' ||
        line.role === 'always' ||
        line.soldAlone === false),
  );
  const hasBase = lines.some(
    (line) =>
      !line.menuId &&
      (line.role === 'base' ||
        (line.role == null && line.soldAlone !== false)),
  );
  const hasMenu = lines.some((line) => line.menuId);
  if (needsBase && !hasBase && !hasMenu) {
    return 'Choisis d’abord un plat de base. Sans lui, la commande ne part pas.';
  }
  return null;
}

/** Un accompagnement ne peut pas être le seul article à la carte. */
export function soldAloneViolation(lines) {
  const rows = Array.isArray(lines) ? lines : [];
  if (rows.some((line) => line.menuId)) return null;
  const components = rows.filter((line) => line.componentId);
  const ids = [...new Set(components.map((line) => line.componentId))];
  if (ids.length !== 1) return null;
  const line = components[0];
  if (line.soldAlone) return null;
  const name = line.name || 'Cet accompagnement';
  return `${name} ne se vend pas tout seul. Ajoute-le à un plat.`;
}

/** Snack in-app + notif navigateur si l’étudiant a déjà autorisé les push. */
export function signalSoldAloneError(message, showSnack) {
  if (!message) return;
  showSnack?.(message);
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Commande impossible', { body: message });
    }
  } catch {
    /* ignore */
  }
}
