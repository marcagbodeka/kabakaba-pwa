import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { IconLock } from '../components/icons';
import { PhoneFormatter } from '../lib/format';

export default function PinLoginPage() {
  const auth = useAuth();
  const [pin, setPin] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (value) => {
    if (auth.isSubmitting || auth.pinLocked) return;
    const ok = await auth.loginWithPin(value);
    if (!ok) setPin('');
  };

  return (
    <div className="pin-page" onClick={() => inputRef.current?.focus()}>
      <div className="pin-icon">
        <IconLock />
      </div>
      <h1>Bon retour</h1>
      <p className="sub">
        {auth.phone
          ? `+228 ${PhoneFormatter.formatDisplay(auth.phone.replace(/^\+?228/, ''))}`
          : `Saisis ton code à ${auth.pinLength} chiffres.`}
      </p>
      <div className="pin-dots">
        {Array.from({ length: auth.pinLength }).map((_, i) => {
          const filled = i < pin.length;
          const next = i === pin.length;
          return (
            <span
              key={i}
              className={`pin-dot${filled ? ' filled' : ''}${next ? ' next' : ''}`}
            />
          );
        })}
      </div>
      <input
        ref={inputRef}
        className="pin-hidden"
        value={pin}
        inputMode="numeric"
        maxLength={auth.pinLength}
        disabled={auth.isSubmitting || auth.pinLocked}
        onChange={(e) => {
          auth.clearError();
          const next = e.target.value.replace(/\D/g, '').slice(0, auth.pinLength);
          setPin(next);
          if (next.length === auth.pinLength) submit(next);
        }}
      />
      {auth.isSubmitting ? <div className="spinner spinner--light" /> : null}
      <button
        type="button"
        className="pin-link"
        onClick={async () => {
          const ok = window.confirm(
            'Ton code sera oublié sur cet appareil. Tu devras te reconnecter avec ton numéro et ton mot de passe temporaire.',
          );
          if (ok) await auth.forget();
        }}
      >
        Utiliser un autre compte
      </button>
    </div>
  );
}
