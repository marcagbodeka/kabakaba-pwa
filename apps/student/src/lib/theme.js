import { useEffect, useState } from 'react';

const KEY = 'kabakaba.theme';

export function readThemeMode() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    /* stockage indisponible */
  }
  return 'system';
}

function resolvedTheme(mode) {
  if (mode === 'dark' || mode === 'light') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(mode = readThemeMode()) {
  const theme = resolvedTheme(mode);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0D1438' : '#1F2B5B');
  return theme;
}

export function setThemeMode(mode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
  applyTheme(mode);
  window.dispatchEvent(new Event('kabakaba-theme'));
}

export function installTheme() {
  applyTheme();
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (readThemeMode() === 'system') applyTheme('system');
  };
  mq.addEventListener?.('change', onChange);
}

export function useThemeMode() {
  const [mode, setMode] = useState(readThemeMode);

  useEffect(() => {
    const sync = () => setMode(readThemeMode());
    window.addEventListener('kabakaba-theme', sync);
    return () => window.removeEventListener('kabakaba-theme', sync);
  }, []);

  return {
    mode,
    choose(next) {
      setThemeMode(next);
      setMode(next);
    },
  };
}
