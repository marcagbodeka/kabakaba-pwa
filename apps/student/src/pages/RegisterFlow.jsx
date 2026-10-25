import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { campusApi } from '../lib/api';
import { PhoneFormatter } from '../lib/format';
import { parsePhoneInput } from '../lib/phoneInput';
import AuthScreen, { PrimaryButton } from '../components/auth/AuthScreen';
import { Field } from '../components/auth/Field';
import OtpInput from '../components/auth/OtpInput';
import CampusSelect from '../components/auth/CampusSelect';
import PhonePrefix from '../components/auth/PhonePrefix';
import {
  IconCap,
  IconEye,
  IconEyeOff,
  IconGift,
  IconGiftSmall,
  IconInfo,
  IconLock,
  IconPhone,
  IconUser,
} from '../components/auth/AuthIcons';

/**
 * Inscription étudiante en 5 écrans (maquette « kabakaba_inscription_hifi »).
 *
 *   1 Téléphone → 2 Code SMS → 3 Identité → 4 Campus & code PIN → 5 Parrainage
 *
 * Contrat backend inchangé : send-otp, verify-otp (code + campus + parrain),
 * puis student/set-pin (PIN + prénom/nom). Le campus et le parrain n'étant
 * connus qu'aux écrans 4 et 5, le code SMS est d'abord « sondé » à l'écran 2
 * (le backend répond « campus requis » pour un nouveau compte), puis renvoyé
 * avec campus + parrain à la création.
 */
const OTP_LENGTH = 6;
const STEP_NUMBER = { phone: 1, otp: 2, identity: 3, secure: 4, referral: 5 };

const nbsp = (s) => String(s).replace(/ /g, '\u00A0');
const clock = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const errText = (err) => String(err?.message || err?.payload?.message || '');

export default function RegisterFlow({ initialPhone = '', recovery = false, onLogin }) {
  const auth = useAuth();

  // --- Navigation : chaque « retour » revient à l'écran précédent ---
  const [stack, setStackState] = useState(['phone']);
  const stackRef = useRef(['phone']);
  const onLoginRef = useRef(onLogin);
  const phoneRef = useRef('');

  const setStack = useCallback((next) => {
    stackRef.current = next;
    setStackState(next);
  }, []);

  // Le retour du téléphone (bouton ou geste Android) suit la même pile.
  useEffect(() => {
    window.history.replaceState({ kbkRoot: true }, '');
    window.history.pushState({ kbkReg: true, depth: 0 }, '');
    const onPop = (e) => {
      const st = e.state;
      if (st?.kbkReg) setStack(stackRef.current.slice(0, st.depth + 1));
      else onLoginRef.current?.(phoneRef.current); // avant le 1er écran → écran de connexion
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setStack]);

  const go = useCallback(
    (next) => {
      const s = [...stackRef.current, next];
      window.history.pushState({ kbkReg: true, depth: s.length - 1 }, '');
      setStack(s);
    },
    [setStack],
  );

  const back = useCallback(() => window.history.back(), []);

  const resetTo = useCallback((name) => {
    const idx = stackRef.current.indexOf(name);
    const delta = stackRef.current.length - 1 - idx;
    if (idx >= 0 && delta > 0) window.history.go(-delta);
  }, []);

  const current = stack[stack.length - 1];

  // --- Données saisies ---
  const [phone, setPhone] = useState(() => PhoneFormatter.formatDisplay(PhoneFormatter.toNational(initialPhone)));
  const [e164, setE164] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpReset, setOtpReset] = useState(0);
  const [seconds, setSeconds] = useState(60);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [campusId, setCampusId] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [referral, setReferral] = useState('');
  // Compte déjà existant (code PIN oublié) : le backend a accepté le code sans campus.
  const [existing, setExisting] = useState(false);

  useEffect(() => {
    onLoginRef.current = onLogin;
    phoneRef.current = phone;
  });

  const tokenReady = useRef(false); // jeton de création de PIN déjà obtenu
  const verifying = useRef(false);
  const lastNameRef = useRef(null);

  // --- Campus ---
  const [campuses, setCampuses] = useState([]);
  const [campusesError, setCampusesError] = useState('');
  const [campusesLoading, setCampusesLoading] = useState(false);

  const loadCampuses = useCallback(async () => {
    setCampusesLoading(true);
    setCampusesError('');
    try {
      const list = await campusApi.list();
      const rows = Array.isArray(list) ? list : [];
      setCampuses(rows);
      if (!rows.length) setCampusesError('Aucun campus disponible pour le moment.');
    } catch (err) {
      setCampuses([]);
      setCampusesError(
        err?.message || 'Impossible de charger les campus. Vérifie ta connexion ou réessaie.',
      );
    } finally {
      setCampusesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampuses();
  }, [loadCampuses]);

  // --- Minuteur du code SMS ---
  useEffect(() => {
    if (current !== 'otp') return undefined;
    setSeconds(60);
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [current, otpReset]);

  // --- Actions ---
  const onPhoneChange = (raw) => setPhone(parsePhoneInput(raw));

  const phoneValid = PhoneFormatter.isValidLocal(phone);

  const sendCode = async ({ advance }) => {
    try {
      const sent = await auth.sendOtp(phone);
      setE164(sent);
      tokenReady.current = false;
      setExisting(false);
      setOtpCode('');
      setOtpReset((n) => n + 1);
      if (advance) go('otp');
    } catch {
      /* message affiché par le contexte */
    }
  };

  const verifyCode = async (code) => {
    if (verifying.current || code.length !== OTP_LENGTH) return;
    if (tokenReady.current) {
      go('identity'); // code déjà accepté (retour arrière) : il est à usage unique
      return;
    }
    verifying.current = true;
    try {
      await auth.verifyOtp({ phone: e164 || phone, code, silentCampus: true });
      // Accepté sans campus : le compte existe déjà (PIN oublié).
      tokenReady.current = true;
      setExisting(true);
      go('identity');
    } catch (err) {
      if (/campus/i.test(errText(err))) {
        // Réponse attendue pour un nouveau compte : le code est bon, il manque le campus.
        setExisting(false);
        go('identity');
      } else {
        setOtpCode('');
        setOtpReset((n) => n + 1);
      }
    } finally {
      verifying.current = false;
    }
  };

  const identity = () => ({ firstName: firstName.trim(), lastName: lastName.trim() });

  const createAccount = async (referralValue) => {
    const ref = referralValue.trim().toUpperCase();
    if (!tokenReady.current) {
      try {
        await auth.verifyOtp({
          phone: e164 || phone,
          code: otpCode,
          campusId: existing ? undefined : campusId || undefined,
          referralCode: ref || undefined,
        });
        tokenReady.current = true;
      } catch (err) {
        const msg = errText(err);
        if (/parrain|referral|ambassad|invit/i.test(msg)) return; // on corrige ici
        if (/campus/i.test(msg)) {
          resetTo('secure');
          return;
        }
        setOtpCode('');
        setOtpReset((n) => n + 1);
        resetTo('otp');
        return;
      }
    }
    try {
      await auth.setPin(pin, identity());
    } catch {
      /* message affiché par le contexte ; le jeton reste valable pour réessayer */
    }
  };

  const pinValid = pin.length === auth.pinLength;
  const identityValid = Boolean(firstName.trim() && lastName.trim());
  const secureValid = pinValid && (existing || Boolean(campusId));

  const submitSecure = () => {
    if (!secureValid || auth.busy) return;
    if (existing) createAccount('');
    else go('referral');
  };

  // --- Rendu par écran ---
  const national = PhoneFormatter.toNational(e164 || phone);
  const shownPhone = nbsp(`+228 ${PhoneFormatter.formatDisplay(national)}`);

  let icon;
  let title;
  let subtitle;
  let body;
  let footer;

  if (current === 'phone') {
    icon = <IconPhone />;
    title = recovery ? 'Retrouve ton compte' : 'Crée ton compte';
    subtitle = 'Entre ton numéro pour recevoir un code de vérification par SMS.';
    body = (
      <Field label="Numéro de téléphone" prefix={<PhonePrefix />}>
        {(id) => (
          <input
            id={id}
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && phoneValid && !auth.busy) {
                e.preventDefault();
                sendCode({ advance: true });
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
    );
    footer = (
      <>
        <PrimaryButton
          arrow
          disabled={auth.busy || !phoneValid}
          onClick={() => sendCode({ advance: true })}
        >
          {auth.busy ? 'Envoi…' : 'Continuer'}
        </PrimaryButton>
        <div className="reg-foot">
          Déjà un compte ? <button type="button" onClick={back}>Se connecter</button>
        </div>
      </>
    );
  } else if (current === 'otp') {
    icon = <IconLock />;
    title = 'Vérifie ton numéro';
    subtitle = <>Code envoyé par SMS au <span className="reg-nowrap">{shownPhone}</span>.</>;
    body = (
      <>
        <OtpInput
          length={OTP_LENGTH}
          value={otpCode}
          disabled={auth.busy}
          resetKey={otpReset}
          onChange={(v) => {
            setOtpCode(v);
            if (v.length === OTP_LENGTH) verifyCode(v);
          }}
        />
        {seconds > 0 ? (
          <div className="reg-timer">
            Renvoyer le code dans <span>{clock(seconds)}</span>
          </div>
        ) : (
          <button
            type="button"
            className="reg-resend"
            disabled={auth.busy}
            onClick={() => sendCode({ advance: false })}
          >
            Renvoyer le code
          </button>
        )}
      </>
    );
    footer = (
      <PrimaryButton
        disabled={auth.busy || otpCode.length !== OTP_LENGTH}
        onClick={() => verifyCode(otpCode)}
      >
        {auth.busy ? 'Vérification…' : 'Vérifier le code'}
      </PrimaryButton>
    );
  } else if (current === 'identity') {
    icon = <IconUser />;
    title = (
      <>
        Comment <span className="reg-nowrap">tu t’appelles ?</span>
      </>
    );
    subtitle = 'Ces informations créent ton profil étudiant kabakaba.';
    body = (
      <>
        <Field label="Prénom(s)" icon={<IconUser size={16} />}>
          {(id) => (
            <input
              id={id}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  lastNameRef.current?.focus();
                }
              }}
              placeholder="Prénom"
              autoComplete="given-name"
              autoCapitalize="words"
              enterKeyHint="next"
              autoFocus
            />
          )}
        </Field>
        <Field label="Nom" icon={<IconUser size={16} />}>
          {(id) => (
            <input
              id={id}
              ref={lastNameRef}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && identityValid) {
                  e.preventDefault();
                  go('secure');
                }
              }}
              placeholder="Nom"
              autoComplete="family-name"
              autoCapitalize="words"
              enterKeyHint="go"
            />
          )}
        </Field>
      </>
    );
    footer = (
      <PrimaryButton arrow disabled={!identityValid} onClick={() => go('secure')}>
        Continuer
      </PrimaryButton>
    );
  } else if (current === 'secure') {
    icon = <IconCap />;
    title = 'Campus & sécurité';
    subtitle = existing
      ? `Crée un code PIN à ${auth.pinLength} chiffres pour te reconnecter sans SMS.`
      : `Choisis ton université et crée un code PIN à ${auth.pinLength} chiffres.`;
    body = (
      <>
        {existing ? null : (
          <CampusSelect
            campuses={campuses}
            value={campusId}
            loading={campusesLoading}
            error={campusesError}
            onChange={setCampusId}
            onRetry={loadCampuses}
          />
        )}
        <Field
          label="Code PIN"
          icon={<IconLock size={16} />}
          right={
            <button
              type="button"
              className="reg-eye"
              onClick={() => setShowPin((v) => !v)}
              aria-label={showPin ? 'Masquer le code' : 'Afficher le code'}
              aria-pressed={showPin}
            >
              {showPin ? <IconEyeOff /> : <IconEye />}
            </button>
          }
        >
          {(id) => (
            <input
              id={id}
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, auth.pinLength))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitSecure();
                }
              }}
              placeholder={`${auth.pinLength} chiffres`}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="new-password"
              enterKeyHint="go"
              maxLength={auth.pinLength}
            />
          )}
        </Field>
      </>
    );
    footer = (
      <PrimaryButton arrow disabled={auth.busy || !secureValid} onClick={submitSecure}>
        {auth.busy ? 'Enregistrement…' : 'Continuer'}
      </PrimaryButton>
    );
  } else {
    icon = <IconGift />;
    title = 'Qui t’a invité ?';
    subtitle = 'Code d’un ambassadeur kabakaba, entièrement facultatif.';
    body = (
      <>
        <Field label="Code de parrainage (optionnel)" icon={<IconGiftSmall size={16} />}>
          {(id) => (
            <input
              id={id}
              value={referral}
              onChange={(e) => setReferral(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !auth.busy) {
                  e.preventDefault();
                  createAccount(referral);
                }
              }}
              placeholder="ex. KOFFI2026"
              maxLength={12}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
            />
          )}
        </Field>
        <div className="reg-hint">
          <span className="ic">
            <IconInfo />
          </span>
          Une fois ton compte créé, ce code ne pourra plus être modifié.
        </div>
      </>
    );
    footer = (
      <>
        <PrimaryButton disabled={auth.busy} onClick={() => createAccount(referral)}>
          {auth.busy ? 'Création…' : 'Créer mon compte'}
        </PrimaryButton>
        <button
          type="button"
          className="reg-skip"
          disabled={auth.busy}
          onClick={() => {
            setReferral('');
            createAccount('');
          }}
        >
          Passer cette étape
        </button>
      </>
    );
  }

  return (
    <AuthScreen
      step={STEP_NUMBER[current]}
      total={5}
      icon={icon}
      title={title}
      subtitle={subtitle}
      stepKey={current}
      onBack={back}
      footer={footer}
    >
      {body}
    </AuthScreen>
  );
}
