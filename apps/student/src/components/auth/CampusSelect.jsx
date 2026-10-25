import { useEffect, useId, useState } from 'react';
import { IconCheck, IconChevronDown } from './AuthIcons';

/**
 * Champ « Université / Campus » (coque de la maquette) + feuille de choix
 * sombre qui monte du bas. Le champ n'ouvre pas de clavier : on ferme celui
 * qui serait encore ouvert avant d'afficher la liste.
 */
export default function CampusSelect({ campuses, value, loading, error, onChange, onRetry }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const chosen = campuses.find((c) => c.id === value);

  const placeholder = 'Sélectionner ton campus';

  const show = () => {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body) el.blur();
    if (!campuses.length && !loading) onRetry?.();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="reg-field">
      <label id={`${id}-label`}>Université / Campus</label>
      <button
        type="button"
        className={`reg-shell reg-select${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        onClick={show}
      >
        <span className={`val${chosen ? ' chosen' : ''}`}>{chosen ? chosen.name : placeholder}</span>
        <span className="chev">
          <IconChevronDown />
        </span>
      </button>

      {open ? (
        <>
          <div className="reg-sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="reg-sheet" role="dialog" aria-modal="true" aria-label="Choisir un campus">
            <div className="reg-sheet-handle" />
            <h2>Université / Campus</h2>
            <div className="reg-sheet-list" role="listbox" aria-label="Campus">
              {loading ? <p className="reg-sheet-msg">Chargement des campus…</p> : null}
              {!loading && error ? (
                <p className="reg-sheet-msg">
                  {error}{' '}
                  <button type="button" onClick={onRetry}>
                    Réessayer
                  </button>
                </p>
              ) : null}
              {campuses.map((c) => {
                const active = c.id === value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`reg-option${active ? ' active' : ''}`}
                    onClick={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                  >
                    <span className="txt">
                      <strong>{c.name}</strong>
                      {c.city ? <span className="sub">{c.city}</span> : null}
                    </span>
                    {active ? (
                      <span className="tick">
                        <IconCheck />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
