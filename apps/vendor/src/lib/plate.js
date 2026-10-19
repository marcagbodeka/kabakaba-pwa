/** Même vocabulaire que la PWA étudiant et que le contrôle de commande. */
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

export function roleOfName(name) {
  return BY_NAME[name] || 'other';
}

export function roleOfComponent(component, categories) {
  const cat = (categories || []).find((c) => c.id === component?.categoryId);
  return roleOfName(cat?.name);
}

export function isIncludedRole(role) {
  return role === 'choice' || role === 'always';
}
