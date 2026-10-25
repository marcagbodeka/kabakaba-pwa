import { useEffect, useRef, useState } from 'react';

/**
 * Code SMS : cases visuelles + un seul champ réel invisible par-dessus.
 * - un toucher n'importe où ouvre le clavier numérique ;
 * - le collage et le remplissage automatique du SMS (one-time-code) marchent ;
 * - la case « curseur » est la prochaine à remplir.
 */
export default function OtpInput({ length = 6, value, onChange, disabled, resetKey }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    // Après le rendu : le champ est désactivé pendant la vérification.
    const raf = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [resetKey]);

  const cursor = Math.min(value.length, length - 1);

  return (
    <div className="reg-otp">
      {Array.from({ length }).map((_, i) => {
        const filled = i < value.length;
        const isCursor = focused && !disabled && i === cursor && value.length < length;
        return (
          <div
            key={i}
            className={`reg-otp-box${filled ? ' filled' : ''}${isCursor ? ' cursor' : ''}`}
          >
            {value[i] || ''}
          </div>
        );
      })}
      <input
        ref={ref}
        value={value}
        disabled={disabled}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        enterKeyHint="go"
        maxLength={length}
        aria-label={`Code de vérification à ${length} chiffres`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
      />
    </div>
  );
}
