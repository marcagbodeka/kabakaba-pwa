import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { authApi, markSessionAlive, normalizeUser, userApi } from '../lib/api';
import { clearViews, readView, writeView } from '../lib/instantView';
import {
  clearTokens,
  forgetDevice,
  isPinSessionFresh,
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
  // Copie synchrone du jeton : permet d'enchaîner verifyOtp puis setPin dans le même geste.
  const pinSetupTokenRef = useRef(null);
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
        const current = loadSession();
        if (current.pinConfigured && !current.pinVerifiedAt) {
          setSession(saveSession({ pinVerifiedAt: Date.now() }));
        }
        setStatus(statusAfterUser(me));
      } catch (err) {
        const next = loadSession();
        setSession(next);
        const authFail = err?.statusCode === 401 || err?.statusCode === 403;
        const soft = err?.statusCode === 429 || err?.statusCode >= 500;
        const cached = readView('me');
        const pinFresh = isPinSessionFresh(next) || !next.pinVerifiedAt;
        // Trace d'une vraie session : profil mémorisé, PIN configuré ou jeton enregistré.
        // Sans elle (premier passage, rafraîchissement en pleine inscription), une erreur
        // quelconque du serveur ne doit pas ouvrir l'accueil vide : retour à l'inscription.
        const hadSession = Boolean(
          cached || next.pinConfigured || next.accessToken || next.refreshToken,
        );
        if (hadSession && pinFresh && (cached || soft || !authFail || next.pinConfigured)) {
          if (cached) commitUser(cached);
          setStatus(cached ? statusAfterUser(cached) : 'authenticated');
        } else {
          setStatus(statusFromSession(next));
          if (authFail && !isPinSessionFresh(next)) setUser(null);
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
      // `silent` : erreur attendue, gérée par l'écran appelant (pas de message à l'utilisateur).
      if (!err?.silent) setError(err.message || 'Une erreur est survenue');
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
    ({ phone, code, campusId, referralCode, silentCampus }) =>
      run(async () => {
        const body = {
          phone: PhoneFormatter.toE164(phone),
          code,
        };
        if (campusId) body.campusId = campusId;
        if (referralCode?.trim()) body.referralCode = referralCode.trim().toUpperCase();
        let res;
        try {
          res = await authApi.verifyOtp(body);
        } catch (err) {
          // Nouveau compte sondé sans campus : réponse attendue, pas une erreur à afficher.
          if (silentCampus && /campus/i.test(String(err?.message || err?.payload?.message || ''))) {
            err.silent = true;
          }
          throw err;
        }

        if (res.stage === 'PIN_SETUP_REQUIRED' && res.pinSetupToken) {
          pinSetupTokenRef.current = res.pinSetupToken;
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
        const token = pinSetupTokenRef.current || pinSetupToken;
        if (!token) {
          throw new Error('Session expirée. Recommence la connexion.');
        }
        const res = await authApi.setPin(token, pin, identity);
        if (res.user?.role && res.user.role !== 'STUDENT') {
          throw new Error('Ce compte n’est pas un compte étudiant.');
        }
        markSessionAlive();
        const next = saveSession({
          pinConfigured: true,
          pinVerifiedAt: Date.now(),
          accessToken: res?.accessToken || loadSession().accessToken,
          refreshToken: res?.refreshToken || loadSession().refreshToken,
        });
        setSession(next);
        pinSetupTokenRef.current = null;
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
          pinVerifiedAt: Date.now(),
          accessToken: res?.accessToken || loadSession().accessToken,
          refreshToken: res?.refreshToken || loadSession().refreshToken,
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
    pinSetupTokenRef.current = null;
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
    pinSetupTokenRef.current = null;
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
