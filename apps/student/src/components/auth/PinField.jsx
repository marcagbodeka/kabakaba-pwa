import { useEffect, useId, useRef, useState } from 'react';
import { IconLock } from './AuthIcons';

const REVEAL_MS = 900; // durée pendant laquelle le dernier chiffre reste visible

/**
 * Champ du code PIN pour la connexion.
 * Chaque chiffre tapé reste visible un court instant, puis devient « * ».
 * Un seul champ réel, invisible, couvre la coque : un toucher n'importe où
 * ouvre le clavier numérique, et le collage fonctionne.
 * `shakeKey` : incrémenté après un PIN refusé (secousse, puis refocalisation).
 */
export default function PinField({
  label = 'Code PIN',
  length = 4,
  value,
  onChange,
  onSubmit,
  disabled,
  shakeKey = 0,
}) {
  const id = useId();
  const inputRef = useRef(null);
  const shellRef = useRef(null);
  const timer = useRef(0);
  const [revealLast, setRevealLast] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Champ vidé de l'extérieur (PIN refusé) : plus rien à montrer.
  useEffect(() => {
    if (!value) {
      window.clearTimeout(timer.current);
      setRevealLast(false);
    }
  }, [value]);

  // PIN refusé : secousse puis retour du curseur dans le champ.
  useEffect(() => {
    if (!shakeKey) return undefined;
    const shell = shellRef.current;
    shell?.classList.remove('is-shake');
    void shell?.offsetWidth; // relance l'animation
    shell?.classList.add('is-shake');
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [shakeKey]);

  const handleChange = (e) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, length);
    window.clearTimeout(timer.current);
    if (next.length === value.length + 1) {
      setRevealLast(true);
      timer.current = window.setTimeout(() => setRevealLast(false), REVEAL_MS);
    } else {
      setRevealLast(false);
    }
    onChange(next);
  };

  const shown = value
    .split('')
    .map((c, i) => (revealLast && i === value.length - 1 ? c : '*'))
    .join('');

  return (
    <div className="reg-field">
      <label htmlFor={id}>{label}</label>
      <div
        ref={shellRef}
        className="reg-shell reg-pin"
        onAnimationEnd={(e) => e.currentTarget.classList.remove('is-shake')}
      >
        <span className="ic">
          <IconLock size={16} />
        </span>
        <span className="reg-pin-view" aria-hidden="true">
          {!value && focused && !disabled ? <i className="reg-caret reg-caret-start" /> : null}
          {value ? shown : <span className="ph">{`${length} chiffres`}</span>}
          {value && focused && !disabled ? <i className="reg-caret" /> : null}
        </span>
        <input
          id={id}
          ref={inputRef}
          value={value}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={length}
          autoFocus
          aria-label={label}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit?.();
            }
          }}
        />
      </div>
    </div>
  );
}
