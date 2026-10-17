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
  loadSession,
  saveSession,
} from '../lib/session';
import { PhoneFormatter } from '../lib/format';
import { registerWebPush, unregisterWebPush } from '../lib/push';

const AuthContext = createContext(null);

function statusFromSession(session) {
  if (session.phone && session.pinConfigured) return 'needsPin';
  return 'needsOtp';
}

export function isIdentityComplete(user) {
  return Boolean(user?.firstName?.trim() && user?.lastName?.trim());
}

function statusAfterUser(user) {
  return isIdentityComplete(user) ? 'authenticated' : 'needsIdentity';
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
      try {
        const me = await refreshMe();
        setStatus(statusAfterUser(me));
      } catch {
        const next = loadSession();
        setSession(next);
        setStatus(statusFromSession(next));
        setUser(null);
      } finally {
        setReady(true);
      }
    })();
  }, [refreshMe]);

  useEffect(() => {
    if ((status === 'authenticated' || status === 'needsIdentity') && ready) {
      registerWebPush().catch(() => {});
    }
  }, [status, ready]);

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

        throw new Error('Réponse de connexion inattendue. Réessaie.');
      }),
    [run],
  );

  const setPin = useCallback(
    (pin, identity) =>
      run(async () => {
        if (!pinSetupToken) {
          throw new Error('Session expirée. Recommence la connexion.');
        }
        const res = await authApi.setPin(pinSetupToken, pin, identity);
        if (res.user?.role && res.user.role !== 'STUDENT') {
          throw new Error('Ce compte n’est pas un compte étudiant.');
        }
        const next = saveSession({ pinConfigured: true });
        setSession(next);
        setPinSetupToken(null);
        const me = await userApi.me().catch(() => normalizeUser(res.user));
        setUser(me);
        setStatus(statusAfterUser(me));
        registerWebPush().catch(() => {});
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
          phone: e164,
          pinConfigured: true,
        });
        setSession(next);
        const me = await userApi.me().catch(() => normalizeUser(res.user));
        setUser(me);
        setStatus(statusAfterUser(me));
        registerWebPush().catch(() => {});
        return true;
      }),
    [run],
  );

  const completeIdentity = useCallback(
    ({ firstName, lastName }) =>
      run(async () => {
        if (!user?.id) throw new Error('Session expirée. Reconnecte-toi.');
        const updated = await userApi.update(user.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
        setUser(updated);
        setStatus('authenticated');
        return updated;
      }),
    [run, user?.id],
  );

  const logout = useCallback(async () => {
    await unregisterWebPush();
    try {
      await authApi.logout();
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
    await unregisterWebPush();
    try {
      await authApi.logout();
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
      needsIdentity: status === 'needsIdentity',
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
      completeIdentity,
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
      completeIdentity,
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
