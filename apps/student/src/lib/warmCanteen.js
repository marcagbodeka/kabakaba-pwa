import { catalogApi, vendorsApi } from './api';
import { readView, writeView } from './instantView';

/** Précharge la fiche cantine pour que le tap s'ouvre déjà rempli. */
export function warmCanteen(vendorId) {
  if (!vendorId || readView(`canteen:${vendorId}`)) return;
  Promise.all([
    vendorsApi.get(vendorId),
    catalogApi.menus(vendorId),
    catalogApi.components(vendorId),
    catalogApi.categories(vendorId),
  ])
    .then(([vendor, menus, components, categories]) => {
      writeView(`canteen:${vendorId}`, {
        vendor,
        menus: Array.isArray(menus) ? menus : [],
        components: Array.isArray(components) ? components : [],
        categories: Array.isArray(categories) ? categories : [],
      });
    })
    .catch(() => {});
}
