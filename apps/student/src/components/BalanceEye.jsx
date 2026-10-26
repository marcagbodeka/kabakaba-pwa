import { useState } from 'react';

const KEY = 'kabakaba.balanceHidden';

export function useBalanceHidden() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setHidden((current) => {
      const next = !current;
      try {
        localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        /* stockage indisponible */
      }
      return next;
    });
  };

  return { hidden, toggle };
}

export function BalanceEye({ hidden, onToggle }) {
  return (
    <button
      type="button"
      className="hero-eye"
      aria-pressed={hidden}
      aria-label={hidden ? 'Afficher le solde' : 'Masquer le solde'}
      onClick={onToggle}
    >
      {hidden ? <EyeOff /> : <Eye />}
    </button>
  );
}

function Eye() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}
