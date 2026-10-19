/** Même vocabulaire que la PWA vendeur et que le contrôle de commande. */
export const PLATE = {
  base: 'Plat de base',
  extra: 'En plus',
  choice: 'Au choix',
  always: 'Toujours mis',
};

const BY_NAME = {
  [PLATE.base]: 'base',
  [PLATE.extra]: 'extra',
  [PLATE.choice]: 'choice',
  [PLATE.always]: 'always',
};

export function roleOfComponent(component, categories) {
  const cat = (categories || []).find((c) => c.id === component?.categoryId);
  return BY_NAME[cat?.name] || 'other';
}

export function groupPlate(components, categories) {
  const groups = { base: [], extra: [], choice: [], always: [], other: [] };
  for (const component of components || []) {
    groups[roleOfComponent(component, categories)].push(component);
  }
  return groups;
}
