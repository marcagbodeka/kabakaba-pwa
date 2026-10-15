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
  clearSession,
  hasTokens,
  loadSession,
  saveSession,
} from '../lib/session';
import { PhoneFormatter } from '../lib/format';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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
        setAuthenticated(true);
      } catch {
        clearSession();
        setAuthenticated(false);
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
        if (res.user?.role && res.user.role !== 'STUDENT') {
          clearSession();
          throw new Error('Ce compte n’est pas un compte étudiant.');
        }
        saveSession({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          userId: res.user?.id,
        });
        const me = await userApi.me().catch(() => normalizeUser(res.user));
        if (me?.role && me.role !== 'STUDENT') {
          clearSession();
          throw new Error('Ce compte n’est pas un compte étudiant.');
        }
        setUser(me);
        setAuthenticated(true);
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
    clearSession();
    setUser(null);
    setAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      authenticated,
      user,
      busy,
      error,
      setError,
      sendOtp,
      verifyOtp,
      logout,
      refreshMe,
      session: loadSession(),
    }),
    [
      ready,
      authenticated,
      user,
      busy,
      error,
      sendOtp,
      verifyOtp,
      logout,
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
