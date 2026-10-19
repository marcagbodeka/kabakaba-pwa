import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ICON_FILES = [
  'pwa-192.png',
  'pwa-512.png',
  'pwa-512-maskable.png',
  'apple-touch-icon.png',
  'favicon-32.png',
];

/** Empreinte du logo. Elle change dès qu'un fichier d'icône change. */
export function iconRevision(publicDir) {
  const hash = createHash('sha256');
  for (const file of ICON_FILES) {
    hash.update(readFileSync(resolve(publicDir, file)));
  }
  return hash.digest('hex').slice(0, 12);
}

export function versionedIconName(file, revision) {
  return file.replace(/\.png$/, `.${revision}.png`);
}
