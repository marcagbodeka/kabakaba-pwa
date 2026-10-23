import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { registerWebPush, unregisterWebPush } from '../lib/push';
import { markSessionAlive, vendorApi, vendorAuthApi } from '../lib/api';
import { clearViews, readView, writeView } from '../lib/instantView';
import {
  forgetDevice,
  isPinSessionFresh,
  loadSession,
  saveSession,
  clearTokens,
} from '../lib/session';
import { PhoneFormatter } from '../lib/format';

const AuthContext = createContext(null);

function statusFromSession(session) {
  if (session.phone && session.pinConfigured) return 'needsPin';
  return 'needsLogin';
}

function canPaintShell() {
  const session = loadSession();
  return Boolean(readView('vendor') && session.phone && session.pinConfigured);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());
  const [status, setStatus] = useState(() =>
    canPaintShell() ? 'authenticated' : 'needsLogin',
  );
  const [ready, setReady] = useState(canPaintShell);
  const [activationStep, setActivationStep] = useState('credentials');
  const [pinLength, setPinLength] = useState(4);
  const [phoneMasked, setPhoneMasked] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pinLocked, setPinLocked] = useState(false);
  const [onboardingToken, setOnboardingToken] = useState(null);
  const [pinSetupToken, setPinSetupToken] = useState(null);

  const clearError = useCallback(() => setErrorMessage(null), []);

  useEffect(() => {
    (async () => {
      try {
        const me = await vendorApi.me();
        markSessionAlive();
        writeView('vendor', me);
        const current = loadSession();
        if (current.pinConfigured && !current.pinVerifiedAt) {
          setSession(saveSession({ pinVerifiedAt: Date.now() }));
        }
        setStatus('authenticated');
      } catch (err) {
        const next = loadSession();
        setSession(next);
        const authFail = err?.statusCode === 401 || err?.statusCode === 403;
        const soft = err?.statusCode === 429 || err?.statusCode >= 500;
        const pinFresh = isPinSessionFresh(next) || !next.pinVerifiedAt;
        const canStay =
          next.phone &&
          next.pinConfigured &&
          pinFresh &&
          (readView('vendor') || soft || !authFail);
        // Relance dans les 7 jours : on reste connecté, pas de PIN.
        if (canStay || (next.phone && next.pinConfigured && isPinSessionFresh(next))) {
          if (next.pinConfigured && !next.pinVerifiedAt) {
            setSession(saveSession({ pinVerifiedAt: Date.now() }));
          }
          setStatus('authenticated');
        } else {
          setStatus(statusFromSession(next));
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    const onExpired = () => {
      const next = loadSession();
      setSession(next);
      if (isPinSessionFresh(next) && next.pinConfigured) {
        setStatus('authenticated');
        return;
      }
      setStatus(statusFromSession(next));
    };
    window.addEventListener('kaba:session-expired', onExpired);
    return () => window.removeEventListener('kaba:session-expired', onExpired);
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && ready) {
      registerWebPush({ welcome: true }).catch(() => {});
    }
  }, [status, ready]);

  const run = useCallback(async (fn) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      return await fn();
    } catch (err) {
      const message = err?.message || 'Une erreur est survenue';
      setErrorMessage(message);
      if (String(message).toLowerCase().includes('verrouill')) {
        setPinLocked(true);
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const goToLogin = useCallback(() => {
    setStatus('needsLogin');
    setActivationStep('credentials');
    setOnboardingToken(null);
    setPinSetupToken(null);
    setErrorMessage(null);
    setPinLocked(false);
  }, []);

  const goToActivation = useCallback(() => {
    setStatus('needsActivation');
    setActivationStep('credentials');
    setOnboardingToken(null);
    setPinSetupToken(null);
    setErrorMessage(null);
  }, []);

  const startActivation = useCallback(
    (phoneLocal, password) =>
      run(async () => {
        const phone = PhoneFormatter.toE164(phoneLocal);
        const challenge = await vendorAuthApi.activateStart(phone, password);
        setOnboardingToken(challenge.onboardingToken);
        setPhoneMasked(challenge.phoneMasked);
        setPinLength(challenge.pinLength || 4);
        setSession(saveSession({ phone, pinConfigured: false }));
        setActivationStep('otp');
        return true;
      }),
    [run],
  );

  const resendOtp = useCallback(
    () =>
      run(async () => {
        if (!onboardingToken || !session.phone) return false;
        const challenge = await vendorAuthApi.resendOtp(onboardingToken);
        setOnboardingToken(challenge.onboardingToken);
        setPhoneMasked(challenge.phoneMasked);
        return true;
      }),
    [onboardingToken, run, session.phone],
  );

  const verifyOtp = useCallback(
    (code) =>
      run(async () => {
        if (!onboardingToken) {
          setActivationStep('credentials');
          setErrorMessage('Session d’activation expirée. Recommence la connexion.');
          return false;
        }
        const grant = await vendorAuthApi.verifyOtp(onboardingToken, code);
        setPinSetupToken(grant.pinSetupToken);
        setPinLength(grant.pinLength || 4);
        setActivationStep('pinSetup');
        return true;
      }),
    [onboardingToken, run],
  );

  const setPin = useCallback(
    (pin) =>
      run(async () => {
        if (!pinSetupToken) {
          setActivationStep('credentials');
          setErrorMessage('Session d’activation expirée. Recommence la connexion.');
          return false;
        }
        const granted = await vendorAuthApi.setPin(pinSetupToken, pin);
        markSessionAlive();
        const next = saveSession({
          phone: session.phone,
          pinConfigured: true,
          pinVerifiedAt: Date.now(),
          accessToken: granted?.accessToken || loadSession().accessToken,
          refreshToken: granted?.refreshToken || loadSession().refreshToken,
        });
        setSession(next);
        setStatus('authenticated');
        setActivationStep('done');
        setOnboardingToken(null);
        setPinSetupToken(null);
        return true;
      }),
    [pinSetupToken, run, session.phone],
  );

  /**
   * Connexion vendeur existant.
   * - loginWithPin(pin) → utilise le téléphone mémorisé (déverrouillage appareil)
   * - loginWithPin(phoneLocal, pin) → téléphone + PIN (nouvel appareil / login)
   */
  const loginWithPin = useCallback(
    (phoneOrPin, maybePin) =>
      run(async () => {
        const hasPhoneArg = maybePin !== undefined;
        const pin = hasPhoneArg ? maybePin : phoneOrPin;
        const phoneLocal = hasPhoneArg ? phoneOrPin : null;
        const phone = phoneLocal
          ? PhoneFormatter.toE164(phoneLocal)
          : session.phone;
        if (!phone) {
          setErrorMessage('Numéro requis');
          return false;
        }
        const granted = await vendorAuthApi.loginPin(phone, pin);
        markSessionAlive();
        const next = saveSession({
          phone,
          pinConfigured: true,
          pinVerifiedAt: Date.now(),
          accessToken: granted?.accessToken || loadSession().accessToken,
          refreshToken: granted?.refreshToken || loadSession().refreshToken,
        });
        setSession(next);
        setStatus('authenticated');
        setPinLocked(false);
        return true;
      }),
    [run, session.phone],
  );

  const backToCredentials = useCallback(() => {
    setActivationStep('credentials');
    setOnboardingToken(null);
    setPinSetupToken(null);
    setErrorMessage(null);
  }, []);

  const forget = useCallback(async () => {
    await unregisterWebPush();
    try {
      sessionStorage.removeItem('kabakaba_vendor_welcome_sent');
    } catch {
      /* ignore */
    }
    try {
      await vendorAuthApi.logout();
    } catch {
      /* ignore */
    }
    forgetDevice();
    clearViews();
    setSession(loadSession());
    setStatus('needsLogin');
    setActivationStep('credentials');
    setOnboardingToken(null);
    setPinSetupToken(null);
    setPinLocked(false);
  }, []);

  const logout = useCallback(async () => {
    // Garde le deviceToken pour la bienvenue / commandes au prochain login.
    try {
      sessionStorage.removeItem('kabakaba_vendor_welcome_sent');
    } catch {
      /* ignore */
    }
    try {
      await vendorAuthApi.logout();
    } catch {
      /* ignore */
    }
    const next = clearTokens();
    clearViews();
    setSession(next);
    setStatus(statusFromSession(next));
    setPinLocked(false);
  }, []);

  const value = useMemo(
    () => ({
      status,
      ready,
      activationStep,
      phone: session.phone,
      phoneMasked,
      pinLength,
      isSubmitting,
      errorMessage,
      pinLocked,
      clearError,
      goToLogin,
      goToActivation,
      startActivation,
      resendOtp,
      verifyOtp,
      setPin,
      loginWithPin,
      backToCredentials,
      forget,
      logout,
    }),
    [
      status,
      ready,
      activationStep,
      session.phone,
      phoneMasked,
      pinLength,
      isSubmitting,
      errorMessage,
      pinLocked,
      clearError,
      goToLogin,
      goToActivation,
      startActivation,
      resendOtp,
      verifyOtp,
      setPin,
      loginWithPin,
      backToCredentials,
      forget,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
