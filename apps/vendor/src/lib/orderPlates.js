/** Même découpage que la carte : un plat de base, et ce qu’on met dedans. */
const ROLE_BY_CATEGORY = {
  'Plat de base': 'base',
  'En plus': 'extra',
  'Au choix': 'choice',
  'Toujours mis': 'always',
  'Jus & Boissons': 'drink',
};

const INSIDE = new Set(['extra', 'choice', 'always', 'sauce']);

function roleOf(item) {
  if (item?.menuId) return 'menu';
  const category = item?.component?.category?.name;
  if (category && ROLE_BY_CATEGORY[category]) return ROLE_BY_CATEGORY[category];
  if (item?.component && item.component.soldAlone === false) return 'extra';
  return 'solo';
}

function eachOf(quantity, count) {
  const qty = Number(quantity) || 0;
  if (count > 1 && qty % count === 0) return qty / count;
  return qty;
}

function plateFrom(id, rows) {
  const menu = rows.length === 1 && rows[0].menuId ? rows[0] : null;
  if (menu) {
    const count = Number(menu.quantity) || 1;
    const parts = Array.isArray(menu.components) ? menu.components : [];
    const lines = parts.length
      ? parts.map((part, index) => ({
          id: part.id || part.componentId || `${id}-${index}`,
          name: part.component?.name || 'Article',
          each: eachOf(part.quantity, count),
          tickets: null,
        }))
      : [{ id: menu.id, name: menu.name, each: count, tickets: Number(menu.unitPrice || 0) * count }];
    return {
      id,
      title: menu.name || 'Menu',
      count,
      summary: lines
        .filter((line) => line.name !== menu.name)
        .map((line) => (line.each > 1 ? `${line.name} ×${line.each}` : line.name))
        .join(' · '),
      lines,
      tickets: Number(menu.unitPrice || 0) * count,
    };
  }

  const head =
    rows.find((row) => roleOf(row) === 'base') ||
    rows.find((row) => roleOf(row) === 'drink') ||
    rows[0];
  const count = Number(head?.quantity) || 1;
  const lines = rows.map((row) => {
    const quantity = Number(row.quantity) || 0;
    const each = eachOf(quantity, count);
    return {
      id: row.id || row.componentId || row.name,
      name: row.name || 'Article',
      each,
      tickets: Number(row.unitPrice || 0) * quantity,
    };
  });
  const summary = lines
    .filter((line) => line.id !== (head?.id || head?.componentId || head?.name))
    .map((line) => (line.each > 1 ? `${line.name} ×${line.each}` : line.name))
    .join(' · ');
  return {
    id,
    title: head?.name || 'Plat',
    count,
    summary,
    lines,
    tickets: rows.reduce(
      (sum, row) => sum + Number(row.unitPrice || 0) * Number(row.quantity || 0),
      0,
    ),
  };
}

function loosePlates(items) {
  const menus = [];
  const drinks = [];
  const solos = [];
  const bases = [];
  const extras = [];
  for (const item of items) {
    const role = roleOf(item);
    if (role === 'menu') menus.push(item);
    else if (role === 'drink') drinks.push(item);
    else if (role === 'base') bases.push(item);
    else if (INSIDE.has(role)) extras.push(item);
    else solos.push(item);
  }
  const plates = [];
  if (bases.length === 1) {
    plates.push(plateFrom(bases[0].id || bases[0].componentId || 'plat', [bases[0], ...extras]));
  } else if (bases.length === 0 && solos.length === 1 && extras.length) {
    plates.push(plateFrom(solos[0].id || solos[0].componentId || 'plat', [solos[0], ...extras]));
    solos.length = 0;
  } else if (bases.length === 0 && solos.length === 0 && extras.length > 1) {
    plates.push(plateFrom(extras[0].id || extras[0].componentId || 'plat', extras));
    extras.length = 0;
  } else {
    for (const base of bases) plates.push(plateFrom(base.id || base.componentId, [base]));
    for (const extra of extras) plates.push(plateFrom(extra.id || extra.componentId, [extra]));
  }
  for (const menu of menus) plates.push(plateFrom(menu.id || menu.menuId, [menu]));
  for (const drink of drinks) plates.push(plateFrom(drink.id || drink.componentId, [drink]));
  for (const solo of solos) plates.push(plateFrom(solo.id || solo.componentId, [solo]));
  return plates;
}

/** Complète les lignes anciennes avec la carte, quand la commande ne porte pas encore la catégorie. */
export function attachCatalog(items, components, categories) {
  const names = new Map((categories || []).map((category) => [category.id, category.name]));
  const byId = new Map((components || []).map((component) => [component.id, component]));
  return (Array.isArray(items) ? items : []).map((item) => {
    if (!item || item.menuId || item.component?.category?.name) return item;
    const known = byId.get(item.componentId);
    if (!known) return item;
    return {
      ...item,
      component: {
        soldAlone: Boolean(known.soldAlone),
        category: { name: names.get(known.categoryId) || null },
      },
    };
  });
}

/** Plats à afficher : un pain avec son œuf compte pour un seul plat. */
export function orderPlates(items) {
  const list = Array.isArray(items) ? items : [];
  const keyed = new Map();
  const loose = [];
  for (const item of list) {
    if (item?.plateKey) {
      const rows = keyed.get(item.plateKey) || [];
      rows.push(item);
      keyed.set(item.plateKey, rows);
    } else {
      loose.push(item);
    }
  }
  const plates = [];
  for (const [key, rows] of keyed) plates.push(plateFrom(key, rows));
  plates.push(...loosePlates(loose));
  return plates;
}
