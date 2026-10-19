import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authApi, markSessionAlive, normalizeUser, userApi } from '../lib/api';
import { clearViews, readView, writeView } from '../lib/instantView';
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

function cachedMe() {
  const me = readView('me');
  return me && typeof me === 'object' && me.id ? me : null;
}

export function AuthProvider({ children }) {
  const bootUser = cachedMe();
  const [session, setSession] = useState(() => loadSession());
  const [status, setStatus] = useState(() =>
    bootUser ? statusAfterUser(bootUser) : statusFromSession(loadSession()),
  );
  const [ready, setReady] = useState(Boolean(bootUser));
  const [user, setUser] = useState(bootUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pinSetupToken, setPinSetupToken] = useState(null);
  const [pinLength, setPinLength] = useState(4);
  const [phoneMasked, setPhoneMasked] = useState(null);

  const commitUser = useCallback((me) => {
    setUser(me);
    if (me) writeView('me', me);
    return me;
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await userApi.me();
    return commitUser(me);
  }, [commitUser]);

  useEffect(() => {
    (async () => {
      try {
        const me = await refreshMe();
        setStatus(statusAfterUser(me));
      } catch (err) {
        const authFail = err?.statusCode === 401 || err?.statusCode === 403;
        if (authFail || !readView('me')) {
          const next = loadSession();
          setSession(next);
          setStatus(statusFromSession(next));
          setUser(null);
        }
      } finally {
        setReady(true);
      }
    })();
  }, [refreshMe]);

  useEffect(() => {
    if ((status === 'authenticated' || status === 'needsIdentity') && ready) {
      registerWebPush({ welcome: true }).catch(() => {});
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
        markSessionAlive();
        const next = saveSession({ pinConfigured: true });
        setSession(next);
        setPinSetupToken(null);
        const me = await userApi.me().catch(() => normalizeUser(res.user));
        commitUser(me);
        setStatus(statusAfterUser(me));
        registerWebPush().catch(() => {});
        return true;
      }),
    [commitUser, pinSetupToken, run],
  );

  const loginWithPin = useCallback(
    ({ phone, pin }) =>
      run(async () => {
        const e164 = PhoneFormatter.toE164(phone);
        const res = await authApi.loginPin(e164, pin);
        if (res.user?.role && res.user.role !== 'STUDENT') {
          throw new Error('Ce compte n’est pas un compte étudiant.');
        }
        markSessionAlive();
        const next = saveSession({
          phone: e164,
          pinConfigured: true,
        });
        setSession(next);
        const me = await userApi.me().catch(() => normalizeUser(res.user));
        commitUser(me);
        setStatus(statusAfterUser(me));
        registerWebPush().catch(() => {});
        return true;
      }),
    [commitUser, run],
  );

  const completeIdentity = useCallback(
    ({ firstName, lastName }) =>
      run(async () => {
        if (!user?.id) throw new Error('Session expirée. Reconnecte-toi.');
        const updated = await userApi.update(user.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
        commitUser(updated);
        setStatus('authenticated');
        return updated;
      }),
    [commitUser, run, user?.id],
  );

  const logout = useCallback(async () => {
    // Garde le deviceToken pour la bienvenue / commandes au prochain login.
    try {
      sessionStorage.removeItem('kabakaba_student_welcome_sent');
    } catch {
      /* ignore */
    }
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    const next = clearTokens();
    clearViews();
    setSession(next);
    setUser(null);
    setPinSetupToken(null);
    setStatus(statusFromSession(next));
  }, []);

  const forget = useCallback(async () => {
    await unregisterWebPush();
    try {
      sessionStorage.removeItem('kabakaba_student_welcome_sent');
    } catch {
      /* ignore */
    }
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    forgetDevice();
    clearViews();
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
