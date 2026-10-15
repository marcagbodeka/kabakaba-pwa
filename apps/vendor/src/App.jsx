import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ActivationPage from './auth/ActivationPage';
import PinLoginPage from './auth/PinLoginPage';
import Dashboard from './pages/Dashboard';
import InstallPrompt from './components/InstallPrompt';

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
  const [booting, setBooting] = useState(true);
  const [snack, setSnack] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 450);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (auth.errorMessage) {
      setSnack(auth.errorMessage);
      const t = setTimeout(() => setSnack(null), 3200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [auth.errorMessage]);

  const showSnack = (message) => {
    setSnack(message);
    setTimeout(() => setSnack(null), 3200);
  };

  let screen = <Bootstrap />;
  if (!booting) {
    if (auth.status === 'authenticated') {
      screen = <Dashboard showSnack={showSnack} />;
    } else if (auth.status === 'needsPin') {
      screen = <PinLoginPage />;
    } else {
      screen = <ActivationPage />;
    }
  }

  return (
    <div className={`app-shell${auth.status !== 'authenticated' ? ' app-shell--dark' : ''}`}>
      {screen}
      {!booting ? <InstallPrompt /> : null}
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
