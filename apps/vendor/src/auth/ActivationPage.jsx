import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import AuthScaffold from '../components/AuthScaffold';
import VendorInput from '../components/VendorInput';
import { IconInfo } from '../components/icons';
import { PhoneFormatter } from '../lib/format';

function OtpBoxes({ onCompleted, disabled, resetKey }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const refs = useRef([]);

  useEffect(() => {
    setDigits(['', '', '', '', '', '']);
    refs.current[0]?.focus();
  }, [resetKey]);

  const push = (next) => {
    setDigits(next);
    const code = next.join('');
    if (code.length === 6) onCompleted(code);
  };

  return (
    <div className="otp-row">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`otp-box${d ? ' filled' : ''}`}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          maxLength={6}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '');
            if (raw.length > 1) {
              const next = [...digits];
              for (let j = 0; j < 6; j++) next[j] = raw[j] || '';
              push(next);
              refs.current[Math.min(raw.length, 5)]?.focus();
              return;
            }
            const next = [...digits];
            next[i] = raw.slice(-1);
            push(next);
            if (raw && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) {
              refs.current[i - 1]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}

function PinDotsField({ length, value, onChange, disabled }) {
  const ref = useRef(null);
  return (
    <button
      type="button"
      className="pin-dots"
      style={{ background: 'transparent', border: 0, width: '100%' }}
      onClick={() => ref.current?.focus()}
    >
      {Array.from({ length }).map((_, i) => {
        const filled = i < value.length;
        const next = i === value.length;
        return (
          <span
            key={i}
            className={`pin-dot${filled ? ' filled' : ''}${next ? ' next' : ''}`}
          />
        );
      })}
      <input
        ref={ref}
        className="pin-hidden"
        value={value}
        disabled={disabled}
        inputMode="numeric"
        maxLength={length}
        autoFocus
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
      />
    </button>
  );
}

export default function ActivationPage() {
  const auth = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [otpReset, setOtpReset] = useState(0);
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (auth.activationStep !== 'otp') return undefined;
    setSeconds(60);
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [auth.activationStep, otpReset]);

  const stepMeta = {
    credentials: {
      step: 1,
      title: 'Connexion vendeur',
      subtitle:
        'Saisis ton numéro et le mot de passe temporaire reçu de l’administration.',
    },
    otp: {
      step: 2,
      title: 'Vérification SMS',
      subtitle: `Saisis le code à 6 chiffres envoyé au ${auth.phoneMasked || 'numéro indiqué'}.`,
    },
    pinSetup: {
      step: 3,
      title: 'Crée ton code',
      subtitle: `Ce code à ${auth.pinLength} chiffres remplacera ton mot de passe temporaire.`,
    },
    done: {
      step: 3,
      title: 'Crée ton code',
      subtitle: `Ce code à ${auth.pinLength} chiffres remplacera ton mot de passe temporaire.`,
    },
  }[auth.activationStep];

  const onPhoneChange = (raw) => {
    const digits = PhoneFormatter.digitsOf(raw).slice(0, 8);
    setPhone(PhoneFormatter.formatDisplay(digits));
  };

  return (
    <AuthScaffold
      currentStep={stepMeta.step}
      heroIcon={
        <img src="/logo.png" alt="" width="48" height="48" style={{ borderRadius: 14 }} />
      }
      heroTitle={stepMeta.title}
      heroSubtitle={stepMeta.subtitle}
      showBackButton={auth.activationStep !== 'credentials'}
      onBack={auth.backToCredentials}
    >
      {auth.activationStep === 'credentials' ? (
        <>
          <VendorInput
            label="Téléphone"
            prefix="+228"
            value={phone}
            onChange={onPhoneChange}
            placeholder="90 12 34 56"
            inputMode="numeric"
            autoComplete="tel-national"
          />
          <VendorInput
            label="Mot de passe temporaire"
            value={password}
            onChange={setPassword}
            placeholder="Mot de passe reçu"
            password
            autoComplete="current-password"
          />
          <div className="hint-box">
            <IconInfo />
            <span>
              Ce mot de passe t’a été communiqué par l’administration kabakaba. Tu
              créeras ensuite ton code PIN personnel.
            </span>
          </div>
          <button
            type="button"
            className="btn-fill"
            disabled={
              auth.isSubmitting ||
              !PhoneFormatter.isValidLocal(phone) ||
              !password
            }
            onClick={() => auth.startActivation(phone, password)}
          >
            {auth.isSubmitting ? 'Envoi…' : 'Continuer'}
          </button>
        </>
      ) : null}

      {auth.activationStep === 'otp' ? (
        <>
          <OtpBoxes
            disabled={auth.isSubmitting}
            resetKey={otpReset}
            onCompleted={(code) => auth.verifyOtp(code)}
          />
          <div className="timer">
            {seconds > 0 ? (
              <>
                Renvoi possible dans <span>{seconds}s</span>
              </>
            ) : (
              'Tu peux renvoyer le code'
            )}
          </div>
          <button
            type="button"
            className="resend"
            disabled={seconds > 0 || auth.isSubmitting}
            onClick={async () => {
              const ok = await auth.resendOtp();
              if (ok) setOtpReset((n) => n + 1);
            }}
          >
            Renvoyer le code
          </button>
        </>
      ) : null}

      {auth.activationStep === 'pinSetup' || auth.activationStep === 'done' ? (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 13.8, marginBottom: 18, textAlign: 'center' }}>
            Choisis ton code
          </p>
          <PinDotsField
            length={auth.pinLength}
            value={pin}
            disabled={auth.isSubmitting}
            onChange={(v) => {
              setPin(v);
              if (v.length === auth.pinLength) setConfirmPin('');
            }}
          />
          {pin.length === auth.pinLength ? (
            <>
              <p
                style={{
                  color: 'var(--muted)',
                  fontSize: 13.8,
                  margin: '22px 0 18px',
                  textAlign: 'center',
                }}
              >
                Confirme ton code
              </p>
              <PinDotsField
                length={auth.pinLength}
                value={confirmPin}
                disabled={auth.isSubmitting}
                onChange={async (v) => {
                  setConfirmPin(v);
                  if (v.length === auth.pinLength) {
                    if (v !== pin) {
                      setConfirmPin('');
                      setPin('');
                      return;
                    }
                    await auth.setPin(v);
                  }
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
    </AuthScaffold>
  );
}
