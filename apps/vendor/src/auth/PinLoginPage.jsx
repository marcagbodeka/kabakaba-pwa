import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useConfirm } from '../components/ConfirmDialog';
import { PhoneFormatter } from '../lib/format';

export default function PinLoginPage() {
  const auth = useAuth();
  const confirm = useConfirm();
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
      <img className="pin-logo" src="/logo.png" alt="kabakaba" width="88" height="88" />
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
          const ok = await confirm({
            title: 'Utiliser un autre compte',
            message:
              'Tu quittes ce compte sur cet appareil. Tu pourras te reconnecter avec ton numéro et ton code PIN.',
            confirmLabel: 'Quitter',
            danger: true,
          });
          if (ok) await auth.forget();
        }}
      >
        Utiliser un autre compte
      </button>
    </div>
  );
}
