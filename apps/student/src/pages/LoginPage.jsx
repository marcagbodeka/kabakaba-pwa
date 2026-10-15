import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { campusApi } from '../lib/api';
import { PhoneFormatter } from '../lib/format';

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

export default function LoginPage() {
  const auth = useAuth();
  const [step, setStep] = useState('phone'); // phone | otp | campus
  const [phone, setPhone] = useState('');
  const [e164, setE164] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [campusId, setCampusId] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [seconds, setSeconds] = useState(60);
  const [otpReset, setOtpReset] = useState(0);
  const pendingCode = useRef(null);

  useEffect(() => {
    if (step !== 'otp') return undefined;
    setSeconds(60);
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [step, otpReset]);

  useEffect(() => {
    campusApi
      .list()
      .then((list) => setCampuses(Array.isArray(list) ? list : []))
      .catch(() => setCampuses([]));
  }, []);

  const onPhoneChange = (raw) => {
    const digits = PhoneFormatter.digitsOf(raw).slice(0, 8);
    setPhone(PhoneFormatter.formatDisplay(digits));
  };

  const send = async () => {
    try {
      const phoneE164 = await auth.sendOtp(phone);
      setE164(phoneE164);
      setStep('otp');
      setOtpReset((n) => n + 1);
    } catch {
      /* error in context */
    }
  };

  const verify = async (code, withCampus) => {
    try {
      await auth.verifyOtp({
        phone: e164 || phone,
        code,
        campusId: withCampus || campusId || undefined,
        referralCode: referralCode || undefined,
      });
    } catch (err) {
      const msg = String(err.message || '');
      if (msg.toLowerCase().includes('campus')) {
        pendingCode.current = code;
        setStep('campus');
      }
    }
  };

  return (
    <div className="auth-scaffold">
      <div className="auth-hero">
        <div className="auth-brand">kabakaba</div>
        <h1>
          {step === 'phone'
            ? 'Connexion'
            : step === 'campus'
              ? 'Ton campus'
              : 'Code SMS'}
        </h1>
        <p>
          {step === 'phone'
            ? 'Entre ton numéro pour recevoir un code de connexion.'
            : step === 'campus'
              ? 'Choisis ton campus pour finaliser ton inscription.'
              : `Saisis le code envoyé au ${PhoneFormatter.formatDisplay(
                  (e164 || phone).replace(/^\+?228/, ''),
                )}.`}
        </p>
      </div>
      <div className="auth-card">
        {step === 'phone' ? (
          <>
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
            <button
              type="button"
              className="btn-fill"
              disabled={auth.busy || !PhoneFormatter.isValidLocal(phone)}
              onClick={send}
            >
              {auth.busy ? 'Envoi…' : 'Recevoir le code'}
            </button>
          </>
        ) : null}

        {step === 'otp' ? (
          <>
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
          </>
        ) : null}

        {step === 'campus' ? (
          <>
            <div className="field">
              <label>Campus</label>
              <div className="input-shell">
                <select
                  value={campusId}
                  onChange={(e) => setCampusId(e.target.value)}
                >
                  <option value="">Choisir…</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              className="btn-fill"
              disabled={auth.busy || !campusId}
              onClick={() => verify(pendingCode.current, campusId)}
            >
              {auth.busy ? 'Validation…' : 'Continuer'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
