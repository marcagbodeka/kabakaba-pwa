import { useEffect } from 'react';

/**
 * Notification toast qui « tombe » depuis le haut de l’écran.
 * variant: 'error' | 'info' | 'success'
 */
export default function Toast({ message, variant = 'error', onClose, ms = 3800 }) {
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
