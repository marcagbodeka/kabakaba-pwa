import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authApi, normalizeUser, userApi } from '../lib/api';
import {
  clearTokens,
  forgetDevice,
  hasTokens,
  loadSession,
  saveSession,
} from '../lib/session';
import { PhoneFormatter } from '../lib/format';

const AuthContext = createContext(null);

function statusFromSession(session) {
  if (hasTokens(session)) return 'authenticated';
  if (session.phone && session.pinConfigured) return 'needsPin';
  return 'needsOtp';
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());
  const [status, setStatus] = useState(() => statusFromSession(loadSession()));
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pinSetupToken, setPinSetupToken] = useState(null);
  const [pinLength, setPinLength] = useState(4);
  const [phoneMasked, setPhoneMasked] = useState(null);

  const refreshMe = useCallback(async () => {
    const me = await userApi.me();
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    (async () => {
      if (!hasTokens()) {
        setReady(true);
        return;
      }
      try {
        await refreshMe();
        setStatus('authenticated');
      } catch {
        const next = clearTokens();
        setSession(next);
        setStatus(statusFromSession(next));
        setUser(null);
      } finally {
        setReady(true);
      }
    })();
  }, [refreshMe]);

  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err.message || 'Une erreur est survenue');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const sendOtp = useCallback(
    (phoneLocal) =>
      run(async () => {
        const phone = PhoneFormatter.toE164(phoneLocal);
        await authApi.sendOtp(phone);
        setSession(saveSession({ phone }));
        return phone;
      }),
    [run],
  );

  const verifyOtp = useCallback(
    ({ phone, code, campusId, referralCode }) =>
      run(async () => {
        const body = {
          phone: PhoneFormatter.toE164(phone),
          code,
        };
        if (campusId) body.campusId = campusId;
        if (referralCode?.trim()) body.referralCode = referralCode.trim().toUpperCase();
        const res = await authApi.verifyOtp(body);

        if (res.stage === 'PIN_SETUP_REQUIRED' && res.pinSetupToken) {
          setPinSetupToken(res.pinSetupToken);
          setPinLength(res.pinLength || 4);
          setPhoneMasked(res.phoneMasked || null);
          setSession(saveSession({ phone: PhoneFormatter.toE164(phone) }));
          return { stage: 'PIN_SETUP_REQUIRED' };
        }

        // Compat éventuelle (autres rôles) — refusé pour l’app étudiant
        if (res.accessToken) {
          if (res.user?.role && res.user.role !== 'STUDENT') {
            throw new Error('Ce compte n’est pas un compte étudiant.');
          }
          saveSession({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            userId: res.user?.id,
            phone: PhoneFormatter.toE164(phone),
            pinConfigured: Boolean(res.user?.hasPin),
          });
          const me = await userApi.me().catch(() => normalizeUser(res.user));
          setUser(me);
          setSession(loadSession());
          setStatus('authenticated');
          return { stage: 'AUTHENTICATED' };
        }

        throw new Error('Réponse de connexion inattendue. Réessaie.');
      }),
    [run],
  );

  const setPin = useCallback(
    (pin) =>
      run(async () => {
        if (!pinSetupToken) {
          throw new Error('Session expirée. Recommence la connexion.');
        }
        const res = await authApi.setPin(pinSetupToken, pin);
        if (res.user?.role && res.user.role !== 'STUDENT') {
          throw new Error('Ce compte n’est pas un compte étudiant.');
        }
        const next = saveSession({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          userId: res.user?.id,
          pinConfigured: true,
        });
        setSession(next);
        setPinSetupToken(null);
        const me = await userApi.me().catch(() => normalizeUser(res.user));
        setUser(me);
        setStatus('authenticated');
        return true;
      }),
    [pinSetupToken, run],
  );

  const loginWithPin = useCallback(
    ({ phone, pin }) =>
      run(async () => {
        const e164 = PhoneFormatter.toE164(phone);
        const res = await authApi.loginPin(e164, pin);
        if (res.user?.role && res.user.role !== 'STUDENT') {
          throw new Error('Ce compte n’est pas un compte étudiant.');
        }
        const next = saveSession({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          userId: res.user?.id,
          phone: e164,
          pinConfigured: true,
        });
        setSession(next);
        const me = await userApi.me().catch(() => normalizeUser(res.user));
        setUser(me);
        setStatus('authenticated');
        return true;
      }),
    [run],
  );

  const logout = useCallback(async () => {
    try {
      if (hasTokens()) await authApi.logout();
    } catch {
      /* ignore */
    }
    const next = clearTokens();
    setSession(next);
    setUser(null);
    setPinSetupToken(null);
    setStatus(statusFromSession(next));
  }, []);

  const forget = useCallback(async () => {
    try {
      if (hasTokens()) await authApi.logout();
    } catch {
      /* ignore */
    }
    forgetDevice();
    setSession(loadSession());
    setUser(null);
    setPinSetupToken(null);
    setStatus('needsOtp');
  }, []);

  const value = useMemo(
    () => ({
      ready,
      status,
      authenticated: status === 'authenticated',
      user,
      busy,
      error,
      setError,
      session,
      pinSetupToken,
      pinLength,
      phoneMasked,
      sendOtp,
      verifyOtp,
      setPin,
      loginWithPin,
      logout,
      forget,
      refreshMe,
    }),
    [
      ready,
      status,
      user,
      busy,
      error,
      session,
      pinSetupToken,
      pinLength,
      phoneMasked,
      sendOtp,
      verifyOtp,
      setPin,
      loginWithPin,
      logout,
      forget,
      refreshMe,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
