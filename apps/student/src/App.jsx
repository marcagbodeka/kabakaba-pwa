import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import BottomNav from './components/BottomNav';
import Toast from './components/Toast';
import AuthEntry from './pages/AuthEntry';
import WelcomeScreen from './components/auth/WelcomeScreen';
import IdentityPage from './pages/IdentityPage';
import HomePage from './pages/HomePage';
import CanteenListPage from './pages/CanteenListPage';
import CanteenDetailPage from './pages/CanteenDetailPage';
import CartPage from './pages/CartPage';
import OrdersPage from './pages/OrdersPage';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';
import InstallPrompt from './components/InstallPrompt';
import NotificationPrompt from './components/NotificationPrompt';
import PushHeadsUp from './components/PushHeadsUp';
import { ConfirmProvider } from './components/ConfirmDialog';
import { userApi } from './lib/api';

function needsTerms(user) {
  return (
    user?.role === 'STUDENT' &&
    Object.prototype.hasOwnProperty.call(user, 'termsAcceptedAt') &&
    !user.termsAcceptedAt
  );
}

function Bootstrap() {
  return (
    <div className="app-shell app-shell--dark">
      <div className="bootstrap" role="status" aria-live="polite" aria-label="Chargement">
        <img className="bootstrap-logo" src="/logo.png" alt="" width="88" height="88" />
        <div className="bootstrap-title">kabakaba</div>
        <div className="bootstrap-spinner" aria-hidden>
          <div className="spinner spinner--light" />
        </div>
        <p className="bootstrap-caption">Chargement…</p>
      </div>
    </div>
  );
}

function Shell() {
  const auth = useAuth();
  const cart = useCart();
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState(null);
  const [toast, setToast] = useState(null);
  const [focusOrderId, setFocusOrderId] = useState(null);
  const [profilePanel, setProfilePanel] = useState(null);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);

  const showSnack = useCallback((message, variant = 'error') => {
    if (!message) return;
    setToast({ message, variant });
  }, []);

  useEffect(() => {
    if (auth.error) {
      showSnack(auth.error, 'error');
      auth.setError(null);
    }
  }, [auth.error, auth, showSnack]);

  const navigate = (name, props = {}) => {
    if (['home', 'orders', 'wallet', 'profile', 'cart'].includes(name)) {
      setStack(null);
      setTab(name);
      if (name !== 'orders') {
        setFocusOrderId(null);
        setOrderDetailOpen(false);
      }
      setProfilePanel(name === 'profile' ? props.panel || null : null);
      return;
    }
    setStack({ name, props });
  };

  const hideNav =
    Boolean(stack) ||
    tab === 'cart' ||
    orderDetailOpen ||
    stack?.name === 'canteen' ||
    stack?.name === 'canteens';

  let screen = null;
  if (stack?.name === 'canteens') {
    screen = (
      <CanteenListPage
        onBack={() => setStack(null)}
        onSelect={(vendorId) => navigate('canteen', { vendorId })}
        showSnack={showSnack}
      />
    );
  } else if (stack?.name === 'canteen') {
    screen = (
      <CanteenDetailPage
        vendorId={stack.props.vendorId}
        onBack={() => setStack(null)}
        onOpenCart={() => navigate('cart')}
        showSnack={showSnack}
      />
    );
  } else if (tab === 'home') {
    screen = <HomePage onNavigate={navigate} showSnack={showSnack} />;
  } else if (tab === 'orders') {
    screen = (
      <OrdersPage
        focusOrderId={focusOrderId}
        showSnack={showSnack}
        onDetailOpenChange={setOrderDetailOpen}
      />
    );
  } else if (tab === 'cart') {
    screen = (
      <CartPage
        onBack={() => setTab('home')}
        onDiscover={() => navigate('canteens')}
        onOpenCanteen={(id) => navigate('canteen', { vendorId: id })}
        onOrdered={(orderId) => {
          setFocusOrderId(orderId);
          setTab('orders');
        }}
        onScheduled={() => {
          setFocusOrderId(null);
          setTab('orders');
        }}
        onRecharge={() => navigate('wallet')}
        showSnack={showSnack}
      />
    );
  } else if (tab === 'wallet') {
    screen = <WalletPage showSnack={showSnack} />;
  } else if (tab === 'profile') {
    screen = <ProfilePage showSnack={showSnack} initialPanel={profilePanel} />;
  }

  return (
    <div className="app-shell">
      <Toast
        message={toast?.message}
        variant={toast?.variant}
        onClose={() => setToast(null)}
      />
      {screen}
      <PushHeadsUp />
      <NotificationPrompt showSnack={showSnack} />
      {!hideNav ? (
        <BottomNav
          current={tab}
          cartCount={cart.itemCount}
          onChange={(next) => navigate(next)}
        />
      ) : null}
    </div>
  );
}

function Root() {
  const auth = useAuth();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (auth.error) {
      setToast({ message: auth.error, variant: 'error' });
      auth.setError(null);
    }
  }, [auth.error, auth]);

  if (!auth.ready) return <Bootstrap />;

  if (auth.needsIdentity) {
    return (
      <div className="app-shell app-shell--dark">
        <Toast
          message={toast?.message}
          variant={toast?.variant}
          onClose={() => setToast(null)}
        />
        <IdentityPage />
        <InstallPrompt />
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div className="app-shell app-shell--dark">
        <Toast
          message={toast?.message}
          variant={toast?.variant}
          onClose={() => setToast(null)}
        />
        <AuthEntry />
        <InstallPrompt />
      </div>
    );
  }
  if (needsTerms(auth.user)) {
    return (
      <div className="app-shell app-shell--dark">
        <Toast
          message={toast?.message}
          variant={toast?.variant}
          onClose={() => setToast(null)}
        />
        <WelcomeScreen
          firstName={auth.user?.firstName}
          onContinue={async () => {
            try {
              await userApi.update(auth.user.id, { acceptTerms: true });
              await auth.refreshMe();
            } catch (err) {
              setToast({
                message: err?.message || 'Impossible d’enregistrer ton choix',
                variant: 'error',
              });
              throw err;
            }
          }}
        />
      </div>
    );
  }

  return (
    <CartProvider>
      <Shell />
      <InstallPrompt />
    </CartProvider>
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
