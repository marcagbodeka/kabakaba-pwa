import { useEffect } from 'react';

/**
 * Clavier mobile pour les écrans d'inscription.
 *
 * - Détecte le clavier de façon fiable sur iOS (le viewport visuel rétrécit, pas
 *   le layout) comme sur Android Chrome avec interactive-widget=resizes-content
 *   (les deux rétrécissent) : on compare à une hauteur de référence mesurée au
 *   repos, avec en plus le focus d'un champ sur écran tactile.
 * - Pose la classe `reg--kb` (hero compact) et la variable `--kb-inset`
 *   (marge basse égale à la hauteur du clavier quand le layout ne rétrécit pas).
 * - Place le champ actif à hauteur d'yeux : vers 38 % de la zone visible.
 */
const EYE_LEVEL = 0.38; // centre du champ, en fraction de la hauteur visible
const TOLERANCE = 0.14; // en deçà de cet écart, on ne bouge rien
const KEYBOARD_MIN = 120; // px de perte de hauteur pour parler de clavier

const isField = (el) =>
  el instanceof HTMLElement && el.matches('input, textarea, select, [contenteditable="true"]');

export function useAuthKeyboard(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const vv = window.visualViewport;
    const coarse = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    const viewH = () => (vv ? vv.height : window.innerHeight);

    let baseline = viewH();
    let width = window.innerWidth;
    let focused = false;
    let blurTimer = 0;
    let revealTimer = 0;

    const apply = () => {
      const shrunk = baseline - viewH() > KEYBOARD_MIN;
      root.classList.toggle('reg--kb', shrunk || (coarse && focused));
      const inset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      root.style.setProperty('--kb-inset', `${Math.round(inset)}px`);
    };

    /** Amène le champ actif vers la hauteur d'yeux si la carte peut défiler. */
    const reveal = () => {
      const el = document.activeElement;
      if (!isField(el) || !root.contains(el)) return;
      const card = root.querySelector('.reg-card');
      if (!card || card.scrollHeight <= card.clientHeight + 1) return;
      const target = el.closest('.reg-field, .reg-otp') || el;
      const r = target.getBoundingClientRect();
      const top = vv ? vv.offsetTop : 0;
      const wanted = top + viewH() * EYE_LEVEL;
      const delta = r.top + r.height / 2 - wanted;
      if (Math.abs(delta) < viewH() * TOLERANCE) return;
      card.scrollBy({ top: delta, behavior: 'smooth' });
    };

    const scheduleReveal = (delay = 320) => {
      window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(reveal, delay);
    };

    const onResize = () => {
      // Rotation / changement de largeur : nouvelle référence.
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        baseline = viewH();
      } else if (viewH() > baseline) {
        baseline = viewH();
      }
      apply();
      if (focused) scheduleReveal(180);
    };

    const onVvScroll = () => {
      // iOS décale parfois la page pour montrer le champ : on la remet en place.
      if (vv && vv.offsetTop > 0 && window.scrollY !== 0) window.scrollTo(0, 0);
      apply();
    };

    const onFocusIn = (e) => {
      if (!isField(e.target)) return;
      window.clearTimeout(blurTimer);
      focused = true;
      apply();
      scheduleReveal();
    };

    const onFocusOut = () => {
      window.clearTimeout(blurTimer);
      // Petit délai : passer d'un champ à l'autre ne doit pas faire clignoter le hero.
      blurTimer = window.setTimeout(() => {
        focused = isField(document.activeElement);
        apply();
      }, 120);
    };

    vv?.addEventListener('resize', onResize);
    vv?.addEventListener('scroll', onVvScroll);
    window.addEventListener('resize', onResize);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);

    // Cas où un champ est déjà actif à l'affichage (autofocus).
    focused = isField(document.activeElement) && root.contains(document.activeElement);
    apply();

    return () => {
      window.clearTimeout(blurTimer);
      window.clearTimeout(revealTimer);
      vv?.removeEventListener('resize', onResize);
      vv?.removeEventListener('scroll', onVvScroll);
      window.removeEventListener('resize', onResize);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      root.classList.remove('reg--kb');
      root.style.removeProperty('--kb-inset');
    };
  }, [rootRef]);
}
