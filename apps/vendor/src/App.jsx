import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ActivationPage from './auth/ActivationPage';
import LoginPage from './auth/LoginPage';
import PinLoginPage from './auth/PinLoginPage';
import Dashboard from './pages/Dashboard';
import InstallPrompt from './components/InstallPrompt';
import NotificationPrompt from './components/NotificationPrompt';
import PushHeadsUp from './components/PushHeadsUp';
import Toast from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';

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
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (auth.errorMessage) {
      setToast({ message: auth.errorMessage, variant: 'error', id: Date.now() });
      auth.clearError();
    }
  }, [auth.errorMessage, auth]);

  // Stable identity — sinon OrdersPage/Dashboard rechargent en boucle (storm 429).
  const showSnack = useCallback((message, variant = 'info') => {
    if (!message) return;
    setToast({ message, variant, id: Date.now() });
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
      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <ConfirmProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ConfirmProvider>
  );
}
