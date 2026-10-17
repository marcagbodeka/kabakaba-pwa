import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { campusApi } from '../lib/api';
import { PhoneFormatter } from '../lib/format';
import { useKeyboardInset } from '../lib/useKeyboardInset';

function OtpBoxes({ onCompleted, disabled, resetKey }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const refs = useRef([]);

  useEffect(() => {
    setDigits(['', '', '', '', '', '']);
    refs.current[0]?.focus();
  }, [resetKey]);

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
            const next = [...digits];
            if (raw.length > 1) {
              for (let j = 0; j < 6; j++) next[j] = raw[j] || '';
              setDigits(next);
              const code = next.join('');
              if (code.length === 6) onCompleted(code);
              return;
            }
            next[i] = raw.slice(-1);
            setDigits(next);
            if (raw && i < 5) refs.current[i + 1]?.focus();
            const code = next.join('');
            if (code.length === 6) onCompleted(code);
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

export default function LoginPage() {
  useKeyboardInset();
  const auth = useAuth();
  const rememberedPhone = auth.session?.phone || '';
  const preferPin = auth.status === 'needsPin' && Boolean(rememberedPhone);

  const [mode, setMode] = useState(preferPin ? 'pin' : 'otp'); // pin | otp
  const [step, setStep] = useState(preferPin ? 'pin' : 'phone');
  // phone | otp | campus | pinSetup | pinConfirm | pin
  const [phone, setPhone] = useState(() =>
    rememberedPhone
      ? PhoneFormatter.formatDisplay(rememberedPhone.replace(/^\+?228/, ''))
      : '',
  );
  const [e164, setE164] = useState(rememberedPhone || '');
  const [referralCode, setReferralCode] = useState('');
  const [campusId, setCampusId] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [seconds, setSeconds] = useState(60);
  const [otpReset, setOtpReset] = useState(0);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const pendingCode = useRef(null);

  useEffect(() => {
    if (step !== 'otp') return undefined;
    setSeconds(60);
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [step, otpReset]);

  const [campusesError, setCampusesError] = useState('');
  const [campusesLoading, setCampusesLoading] = useState(false);

  const loadCampuses = useCallback(async () => {
    setCampusesLoading(true);
    setCampusesError('');
    try {
      const list = await campusApi.list();
      const rows = Array.isArray(list) ? list : [];
      setCampuses(rows);
      if (!rows.length) {
        setCampusesError('Aucun campus disponible pour le moment.');
      }
    } catch (err) {
      setCampuses([]);
      setCampusesError(
        err?.message ||
          'Impossible de charger les campus. Vérifie ta connexion ou réessaie.',
      );
    } finally {
      setCampusesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampuses();
  }, [loadCampuses]);

  useEffect(() => {
    if (step === 'campus') loadCampuses();
  }, [step, loadCampuses]);

  const onPhoneChange = (raw) => {
    const digits = PhoneFormatter.digitsOf(raw).slice(0, 8);
    setPhone(PhoneFormatter.formatDisplay(digits));
  };

  const send = async () => {
    try {
      const phoneE164 = await auth.sendOtp(phone);
      setE164(phoneE164);
      setStep('otp');
      setMode('otp');
      setOtpReset((n) => n + 1);
    } catch {
      /* toast via context */
    }
  };

  const verify = async (code, withCampus) => {
    try {
      const res = await auth.verifyOtp({
        phone: e164 || phone,
        code,
        campusId: withCampus || campusId || undefined,
        referralCode: referralCode || undefined,
      });
      if (res?.stage === 'PIN_SETUP_REQUIRED') {
        setPin('');
        setConfirmPin('');
        setStep('pinSetup');
      }
    } catch (err) {
      const msg = String(err.message || err?.payload?.message || '');
      // Première inscription : le backend exige un campus (400 attendu).
      if (/campus/i.test(msg)) {
        pendingCode.current = code;
        setStep('campus');
        loadCampuses();
      }
    }
  };

  const title =
    step === 'pin'
      ? 'Code PIN'
      : step === 'pinSetup' || step === 'pinConfirm'
        ? 'Crée ton code'
        : step === 'campus'
          ? 'Ton campus'
          : step === 'otp'
            ? 'Code SMS'
            : mode === 'pin'
              ? 'Connexion'
              : 'Connexion';

  const subtitle =
    step === 'pin'
      ? `Entre ton code à ${auth.pinLength} chiffres pour ${PhoneFormatter.formatDisplay(
          (e164 || phone || rememberedPhone).replace(/^\+?228/, ''),
        )}.`
      : step === 'pinSetup'
        ? 'Choisis un code PIN à 4 chiffres. Tu l’utiliseras pour te reconnecter sans SMS.'
        : step === 'pinConfirm'
          ? 'Saisis encore une fois le même code pour confirmer.'
          : step === 'campus'
            ? 'Choisis ton campus pour finaliser ton inscription.'
            : step === 'otp'
              ? `Saisis le code envoyé au ${PhoneFormatter.formatDisplay(
                  (e164 || phone).replace(/^\+?228/, ''),
                )}.`
              : mode === 'pin'
                ? 'Numéro et code PIN — sans SMS.'
                : 'Première connexion ou code oublié : on t’envoie un SMS.';

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
              <div className="mode-switch">
                <button
                  type="button"
                  className={mode === 'pin' ? 'active' : ''}
                  onClick={() => setMode('pin')}
                >
                  J’ai un code PIN
                </button>
                <button
                  type="button"
                  className={mode === 'otp' ? 'active' : ''}
                  onClick={() => setMode('otp')}
                >
                  SMS / 1ʳᵉ fois
                </button>
              </div>

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

              {mode === 'otp' ? (
                <div className="field">
                  <label>Code parrain (optionnel)</label>
                  <div className="input-shell">
                    <input
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="Ex. K7M2QX9A"
                      maxLength={12}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="auth-card-footer">
              {mode === 'pin' ? (
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
              ) : (
                <button
                  type="button"
                  className="btn-fill"
                  disabled={auth.busy || !PhoneFormatter.isValidLocal(phone)}
                  onClick={send}
                >
                  {auth.busy ? 'Envoi…' : 'Recevoir le code'}
                </button>
              )}
            </div>
          </>
        ) : null}

        {step === 'otp' ? (
          <>
            <div className="auth-card-body">
              <OtpBoxes
                disabled={auth.busy}
                resetKey={otpReset}
                onCompleted={(code) => verify(code)}
              />
              <div className="timer">
                {seconds > 0 ? (
                  <>
                    Renvoi dans <span>{seconds}s</span>
                  </>
                ) : (
                  'Tu peux renvoyer le code'
                )}
              </div>
            </div>
            <div className="auth-card-footer">
              <button
                type="button"
                className="link-btn"
                disabled={seconds > 0 || auth.busy}
                onClick={async () => {
                  await send();
                }}
              >
                Renvoyer le code
              </button>
              <button type="button" className="link-btn" onClick={() => setStep('phone')}>
                Modifier le numéro
              </button>
            </div>
          </>
        ) : null}

        {step === 'campus' ? (
          <>
            <div className="auth-card-body">
              <div className="field">
                <label>Campus</label>
                {campusesLoading ? (
                  <p className="muted" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                    Chargement des campus…
                  </p>
                ) : null}
                <div className="campus-picker" role="listbox" aria-label="Campus">
                  {campuses.map((c) => {
                    const active = campusId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`campus-option${active ? ' active' : ''}`}
                        onClick={() => setCampusId(c.id)}
                      >
                        <strong>{c.name}</strong>
                        {c.city ? <span>{c.city}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
              {campusesError ? (
                <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>
                  {campusesError}{' '}
                  <button type="button" className="link-btn" onClick={loadCampuses}>
                    Réessayer
                  </button>
                </p>
              ) : null}
            </div>
            <div className="auth-card-footer">
              <button
                type="button"
                className="btn-fill"
                disabled={auth.busy || !campusId}
                onClick={() => verify(pendingCode.current, campusId)}
              >
                {auth.busy ? 'Validation…' : 'Continuer'}
              </button>
            </div>
          </>
        ) : null}

        {step === 'pinSetup' ? (
          <>
            <div className="auth-card-body">
              <PinDots
                length={auth.pinLength}
                value={pin}
                disabled={auth.busy}
                autoFocus
                onChange={(v) => {
                  setPin(v);
                  if (v.length === auth.pinLength) {
                    setConfirmPin('');
                    setStep('pinConfirm');
                  }
                }}
              />
            </div>
            <div className="auth-card-footer">
              <button type="button" className="link-btn" onClick={() => setStep('phone')}>
                Annuler
              </button>
            </div>
          </>
        ) : null}

        {step === 'pinConfirm' ? (
          <>
            <div className="auth-card-body">
              <PinDots
                length={auth.pinLength}
                value={confirmPin}
                disabled={auth.busy}
                autoFocus
                onChange={async (v) => {
                  setConfirmPin(v);
                  if (v.length !== auth.pinLength) return;
                  if (v !== pin) {
                    auth.setError('Les deux codes ne correspondent pas.');
                    setPin('');
                    setConfirmPin('');
                    setStep('pinSetup');
                    return;
                  }
                  try {
                    await auth.setPin(v);
                  } catch {
                    setPin('');
                    setConfirmPin('');
                    setStep('pinSetup');
                  }
                }}
              />
            </div>
            <div className="auth-card-footer">
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setPin('');
                  setConfirmPin('');
                  setStep('pinSetup');
                }}
              >
                Recommencer
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
                onClick={() => {
                  setMode('otp');
                  setStep('phone');
                  setPin('');
                }}
              >
                J’ai oublié mon code — recevoir un SMS
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
