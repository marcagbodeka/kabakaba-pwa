import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { iconRevision, versionedIconName } from './iconRevision.js';

const ICON_FILES = [
  'pwa-192.png',
  'pwa-512.png',
  'pwa-512-maskable.png',
  'apple-touch-icon.png',
  'favicon-32.png',
];

/**
 * Le téléphone mémorise l'icône par son URL. Un logo modifié doit donc
 * porter un nouveau nom, dérivé du contenu des fichiers.
 */
export function versionedIconsPlugin(publicDir) {
  const revision = iconRevision(publicDir);
  const icon = (file) => versionedIconName(file, revision);
  return {
    name: 'kabakaba-versioned-icons',
    apply: 'build',
    icon,
    generateBundle() {
      for (const file of ICON_FILES) {
        this.emitFile({
          type: 'asset',
          fileName: icon(file),
          source: readFileSync(resolve(publicDir, file)),
        });
      }
    },
    transformIndexHtml(html) {
      return html
        .replaceAll('href="/favicon-32.png"', `href="/${icon('favicon-32.png')}"`)
        .replaceAll('href="/apple-touch-icon.png"', `href="/${icon('apple-touch-icon.png')}"`);
    },
  };
}
