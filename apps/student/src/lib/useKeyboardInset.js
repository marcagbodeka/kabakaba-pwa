import { useEffect } from 'react';

/**
 * Suit le clavier mobile via visualViewport et expose :
 * - CSS var --keyboard-inset
 * - classe auth-scaffold--keyboard sur le premier .auth-scaffold
 * - scroll du champ focusé dans la zone visible
 */
export function useKeyboardInset() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    if (!vv) return undefined;

    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
      const scaffold = document.querySelector('.auth-scaffold');
      if (scaffold) {
        scaffold.classList.toggle('auth-scaffold--keyboard', inset > 80);
      }
    };

    const onFocusIn = (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (!el.matches('input, textarea, select, [contenteditable="true"]')) return;
      window.setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        sync();
      }, 120);
    };

    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    window.addEventListener('focusin', onFocusIn);
    sync();

    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      window.removeEventListener('focusin', onFocusIn);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
