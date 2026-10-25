import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PhoneFormatter } from '../lib/format';
import { useKeyboardInset } from '../lib/useKeyboardInset';

function PinDots({ length, value, onChange, disabled, autoFocus }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="pin-dots" onClick={() => inputRef.current?.focus()}>
      {Array.from({ length }).map((_, i) => (
        <span
          key={i}
          className={`pin-dot${i < value.length ? ' filled' : ''}${i === value.length ? ' next' : ''}`}
        />
      ))}
      <input
        ref={inputRef}
        className="pin-hidden"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
      />
    </div>
  );
}

/**
 * Connexion par numéro + code PIN (sans SMS).
 * L'inscription et la récupération d'un PIN oublié passent par RegisterFlow
 * (via `onRegister`).
 */
export default function LoginPage({ onRegister, initialPhone = '' }) {
  useKeyboardInset();
  const auth = useAuth();
  const rememberedPhone = auth.session?.phone || '';
  const preferPin = auth.status === 'needsPin' && Boolean(rememberedPhone);

  const [step, setStep] = useState(preferPin ? 'pin' : 'phone'); // phone | pin
  const [phone, setPhone] = useState(() =>
    rememberedPhone
      ? PhoneFormatter.formatDisplay(rememberedPhone.replace(/^\+?228/, ''))
      : PhoneFormatter.formatDisplay(PhoneFormatter.toNational(initialPhone)),
  );
  const [e164, setE164] = useState(rememberedPhone || '');
  const [pin, setPin] = useState('');

  const onPhoneChange = (raw) => {
    const digits = PhoneFormatter.digitsOf(raw).slice(0, 8);
    setPhone(PhoneFormatter.formatDisplay(digits));
  };

  const title = step === 'pin' ? 'Code PIN' : 'Connexion';
  const subtitle =
    step === 'pin'
      ? `Entre ton code à ${auth.pinLength} chiffres pour ${PhoneFormatter.formatDisplay(
          (e164 || phone || rememberedPhone).replace(/^\+?228/, ''),
        )}.`
      : 'Entre ton numéro, puis ton code PIN, sans SMS.';

  return (
    <div className="auth-scaffold">
      <div className="auth-hero">
        <img className="auth-logo" src="/logo.png" alt="" width="56" height="56" />
        <div className="auth-brand">kabakaba</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="auth-card">
        {step === 'phone' ? (
          <>
            <div className="auth-card-body">
              <div className="field">
                <label>Téléphone</label>
                <div className="input-shell">
                  <span className="prefix">+228</span>
                  <input
                    value={phone}
                    onChange={(e) => onPhoneChange(e.target.value)}
                    placeholder="90 12 34 56"
                    inputMode="numeric"
                    autoComplete="tel-national"
                  />
                </div>
              </div>
            </div>
            <div className="auth-card-footer">
              <button
                type="button"
                className="btn-fill"
                disabled={auth.busy || !PhoneFormatter.isValidLocal(phone)}
                onClick={() => {
                  setE164(PhoneFormatter.toE164(phone));
                  setPin('');
                  setStep('pin');
                }}
              >
                Continuer
              </button>
              <button type="button" className="link-btn" onClick={() => onRegister?.(phone)}>
                Pas encore de compte ? S’inscrire
              </button>
            </div>
          </>
        ) : null}

        {step === 'pin' ? (
          <>
            <div className="auth-card-body">
              <PinDots
                length={auth.pinLength}
                value={pin}
                disabled={auth.busy}
                autoFocus
                onChange={async (v) => {
                  setPin(v);
                  if (v.length === auth.pinLength) {
                    try {
                      await auth.loginWithPin({ phone: e164 || phone, pin: v });
                    } catch {
                      setPin('');
                    }
                  }
                }}
              />
            </div>
            <div className="auth-card-footer">
              <button
                type="button"
                className="link-btn"
                onClick={() => onRegister?.(e164 || phone, true)}
              >
                J’ai oublié mon code PIN
              </button>
              <button type="button" className="link-btn" onClick={() => setStep('phone')}>
                Modifier le numéro
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
