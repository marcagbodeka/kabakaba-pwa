import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ActivationPage from './auth/ActivationPage';
import LoginPage from './auth/LoginPage';
import PinLoginPage from './auth/PinLoginPage';
import Dashboard from './pages/Dashboard';
import InstallPrompt from './components/InstallPrompt';
import NotificationPrompt from './components/NotificationPrompt';
import PushHeadsUp from './components/PushHeadsUp';

function Bootstrap() {
  return (
    <div className="bootstrap">
      <img className="bootstrap-logo" src="/logo.png" alt="kabakaba" width="88" height="88" />
      <div className="bootstrap-title">kabakaba</div>
      <div className="bootstrap-sub">ESPACE VENDEUR</div>
      <div className="spinner spinner--light" />
    </div>
  );
}

function Root() {
  const auth = useAuth();
  const [snack, setSnack] = useState(null);

  useEffect(() => {
    if (auth.errorMessage) {
      setSnack(auth.errorMessage);
      const t = setTimeout(() => setSnack(null), 3200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [auth.errorMessage]);

  // Stable identity — sinon OrdersPage/Dashboard rechargent en boucle (storm 429).
  const showSnack = useCallback((message) => {
    if (!message) return;
    setSnack(message);
    setTimeout(() => setSnack(null), 3200);
  }, []);

  let screen = <Bootstrap />;
  if (auth.ready) {
    if (auth.status === 'authenticated') {
      screen = <Dashboard showSnack={showSnack} />;
    } else if (auth.status === 'needsPin') {
      screen = <PinLoginPage />;
    } else if (auth.status === 'needsActivation') {
      screen = <ActivationPage />;
    } else {
      screen = <LoginPage />;
    }
  }

  return (
    <div className={`app-shell${auth.status !== 'authenticated' ? ' app-shell--dark' : ''}`}>
      {screen}
      {auth.ready && auth.status === 'authenticated' ? (
        <>
          <PushHeadsUp />
          <NotificationPrompt showSnack={showSnack} />
        </>
      ) : null}
      {auth.ready ? <InstallPrompt /> : null}
      {snack ? <div className="snack">{snack}</div> : null}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
