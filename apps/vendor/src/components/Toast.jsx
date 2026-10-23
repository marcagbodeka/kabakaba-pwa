import { useEffect } from 'react';

/**
 * Snackbar qui tombe depuis le haut.
 * variant: 'error' | 'info' | 'success'
 */
export default function Toast({ message, variant = 'error', onClose, ms = 4200 }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => onClose?.(), ms);
    return () => clearTimeout(t);
  }, [message, ms, onClose]);

  if (!message) return null;

  return (
    <div className={`toast toast--${variant}`} role="status" aria-live="polite">
      <span className="toast-dot" aria-hidden />
      <p>{message}</p>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Fermer">
        ×
      </button>
    </div>
  );
}
