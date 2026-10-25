import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PhoneFormatter } from '../lib/format';
import { parsePhoneInput } from '../lib/phoneInput';
import AuthScreen, { PrimaryButton } from '../components/auth/AuthScreen';
import { Field } from '../components/auth/Field';
import PhonePrefix from '../components/auth/PhonePrefix';
import PinField from '../components/auth/PinField';
import { IconLock, IconPhone } from '../components/auth/AuthIcons';

const nbsp = (s) => String(s).replace(/ /g, '\u00A0');

/**
 * Connexion en deux pages, même direction artistique que l'inscription :
 *   1. numéro de téléphone   2. code PIN (chiffre visible un instant, puis « * »)
 * « J'ai oublié mon code PIN » mène à la récupération par SMS (RegisterFlow).
 * `onBack` (facultatif) : retour vers l'inscription depuis la page du numéro.
 */
export default function LoginPage({ onRegister, onBack, initialPhone = '' }) {
  const auth = useAuth();
  const rememberedPhone = auth.session?.phone || '';
  const preferPin = auth.status === 'needsPin' && Boolean(rememberedPhone);

  const [step, setStep] = useState(preferPin ? 'pin' : 'phone'); // phone | pin
  const [phone, setPhone] = useState(() =>
    PhoneFormatter.formatDisplay(PhoneFormatter.toNational(rememberedPhone || initialPhone)),
  );
  const [pin, setPin] = useState('');
  const [shakeKey, setShakeKey] = useState(0);

  const stepRef = useRef(step);
  const pushed = useRef(false); // la page PIN a-t-elle une entrée d'historique ?
  const submitting = useRef(false);

  useEffect(() => {
    stepRef.current = step;
  });

  // Geste « retour » du téléphone : de la page PIN vers la page du numéro.
  useEffect(() => {
    const onPop = () => {
      if (stepRef.current === 'pin') {
        pushed.current = false;
        setPin('');
        setStep('phone');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const phoneValid = PhoneFormatter.isValidLocal(phone);

  const goPin = () => {
    if (!phoneValid || auth.busy) return;
    setPin('');
    window.history.pushState({ kbkLogin: true }, '');
    pushed.current = true;
    setStep('pin');
  };

  const backFromPin = () => {
    if (pushed.current) window.history.back();
    else {
      setPin('');
      setStep('phone');
    }
  };

  const login = async (value) => {
    if (submitting.current || value.length !== auth.pinLength) return;
    submitting.current = true;
    try {
      await auth.loginWithPin({ phone: PhoneFormatter.toE164(phone), pin: value });
    } catch {
      // Message affiché par le contexte ; on vide le champ et on le secoue.
      setPin('');
      setShakeKey((k) => k + 1);
    } finally {
      submitting.current = false;
    }
  };

  // Le dernier chiffre reste visible un instant avant l'envoi automatique.
  useEffect(() => {
    if (step !== 'pin' || pin.length !== auth.pinLength) return undefined;
    const t = window.setTimeout(() => login(pin), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, step]);

  if (step === 'pin') {
    const shown = nbsp(`+228 ${PhoneFormatter.formatDisplay(PhoneFormatter.toNational(phone))}`);
    return (
      <AuthScreen
        icon={<IconLock />}
        title="Entre ton code PIN"
        subtitle={
          <>
            Code à {auth.pinLength} chiffres pour le <span className="reg-nowrap">{shown}</span>.
          </>
        }
        stepKey="login-pin"
        onBack={backFromPin}
        footer={
          <PrimaryButton
            disabled={auth.busy || pin.length !== auth.pinLength}
            onClick={() => login(pin)}
          >
            {auth.busy ? 'Connexion…' : 'Se connecter'}
          </PrimaryButton>
        }
      >
        <PinField
          length={auth.pinLength}
          value={pin}
          onChange={setPin}
          onSubmit={() => login(pin)}
          disabled={auth.busy}
          shakeKey={shakeKey}
        />
        <button
          type="button"
          className="reg-forgot"
          onClick={() => onRegister?.(PhoneFormatter.toE164(phone), true)}
        >
          J’ai oublié mon code PIN
        </button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      icon={<IconPhone />}
      title="Content de te revoir"
      subtitle="Entre ton numéro de téléphone pour accéder à ton compte."
      stepKey="login-phone"
      onBack={onBack ? () => onBack(phone) : undefined}
      footer={
        <>
          <PrimaryButton arrow disabled={auth.busy || !phoneValid} onClick={goPin}>
            Continuer
          </PrimaryButton>
          <div className="reg-foot">
            Pas encore de compte ?{' '}
            <button type="button" onClick={() => onRegister?.(phone)}>
              S’inscrire
            </button>
          </div>
        </>
      }
    >
      <Field label="Numéro de téléphone" prefix={<PhonePrefix />}>
        {(id) => (
          <input
            id={id}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(parsePhoneInput(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && phoneValid) {
                e.preventDefault();
                goPin();
              }
            }}
            placeholder="90 12 34 56"
            inputMode="numeric"
            autoComplete="tel-national"
            enterKeyHint="go"
            autoFocus
          />
        )}
      </Field>
    </AuthScreen>
  );
}
