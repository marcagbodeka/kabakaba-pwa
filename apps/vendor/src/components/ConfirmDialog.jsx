import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((opts) => {
    const options = typeof opts === 'string' ? { message: opts } : opts || {};
    return new Promise((resolve) => {
      resolveRef.current?.(false);
      resolveRef.current = resolve;
      setDialog({
        title: options.title || 'Confirmer',
        message: options.message || '',
        confirmLabel: options.confirmLabel || 'Confirmer',
        cancelLabel: options.cancelLabel || 'Annuler',
        danger: Boolean(options.danger),
      });
    });
  }, []);

  const close = useCallback((ok) => {
    setDialog(null);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(ok);
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog ? (
        <div className="consent-backdrop" onClick={() => close(false)}>
          <div
            className="consent-sheet"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title">{dialog.title}</h2>
            <p id="confirm-desc">{dialog.message}</p>
            <div className="consent-actions">
              <button
                type="button"
                className={`consent-allow${dialog.danger ? ' consent-allow--danger' : ''}`}
                onClick={() => close(true)}
              >
                {dialog.confirmLabel}
              </button>
              <button type="button" className="consent-deny" onClick={() => close(false)}>
                {dialog.cancelLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm hors ConfirmProvider');
  return confirm;
}
