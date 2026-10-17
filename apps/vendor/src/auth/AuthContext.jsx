import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { registerWebPush, unregisterWebPush } from '../lib/push';
import { vendorApi, vendorAuthApi } from '../lib/api';
import {
  forgetDevice,
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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());
  const [status, setStatus] = useState('needsLogin');
  const [ready, setReady] = useState(false);
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
        await vendorApi.me();
        setStatus('authenticated');
      } catch {
        const next = loadSession();
        setSession(next);
        setStatus(statusFromSession(next));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && ready) {
      registerWebPush().catch(() => {});
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
        await vendorAuthApi.setPin(pinSetupToken, pin);
        const next = saveSession({
          phone: session.phone,
          pinConfigured: true,
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
        await vendorAuthApi.loginPin(phone, pin);
        const next = saveSession({ phone, pinConfigured: true });
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
      await vendorAuthApi.logout();
    } catch {
      /* ignore */
    }
    forgetDevice();
    setSession(loadSession());
    setStatus('needsLogin');
    setActivationStep('credentials');
    setOnboardingToken(null);
    setPinSetupToken(null);
    setPinLocked(false);
  }, []);

  const logout = useCallback(async () => {
    await unregisterWebPush();
    try {
      await vendorAuthApi.logout();
    } catch {
      /* ignore */
    }
    const next = clearTokens();
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
