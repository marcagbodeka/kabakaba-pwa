import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import BottomNav from './components/BottomNav';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import CanteenListPage from './pages/CanteenListPage';
import CanteenDetailPage from './pages/CanteenDetailPage';
import CartPage from './pages/CartPage';
import OrdersPage from './pages/OrdersPage';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';
import InstallPrompt from './components/InstallPrompt';

function Bootstrap() {
  return (
    <div className="bootstrap">
      <img className="bootstrap-logo" src="/apple-touch-icon.png" alt="kabakaba" width="72" height="72" />
      <div className="bootstrap-title">kabakaba</div>
      <div className="spinner spinner--light" />
    </div>
  );
}

function Shell() {
  const auth = useAuth();
  const cart = useCart();
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState(null); // { name, props }
  const [snack, setSnack] = useState(null);
  const [focusOrderId, setFocusOrderId] = useState(null);

  useEffect(() => {
    if (auth.error) {
      setSnack(auth.error);
      const t = setTimeout(() => {
        setSnack(null);
        auth.setError(null);
      }, 3200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [auth.error]);

  const showSnack = (message) => {
    setSnack(message);
    setTimeout(() => setSnack(null), 3200);
  };

  const navigate = (name, props = {}) => {
    if (['home', 'orders', 'wallet', 'profile', 'cart'].includes(name)) {
      setStack(null);
      setTab(name);
      if (name !== 'orders') setFocusOrderId(null);
      return;
    }
    setStack({ name, props });
  };

  const hideNav =
    Boolean(stack) ||
    tab === 'cart' ||
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
      />
    );
  } else if (tab === 'cart') {
    screen = (
      <CartPage
        onBack={() => setTab('home')}
        onOrdered={(orderId) => {
          setFocusOrderId(orderId);
          setTab('orders');
        }}
        showSnack={showSnack}
      />
    );
  } else if (tab === 'wallet') {
    screen = <WalletPage showSnack={showSnack} />;
  } else if (tab === 'profile') {
    screen = <ProfilePage showSnack={showSnack} />;
  }

  return (
    <div className="app-shell">
      {screen}
      {!hideNav ? (
        <BottomNav
          current={tab}
          cartCount={cart.itemCount}
          onChange={(next) => navigate(next)}
        />
      ) : null}
      {snack ? <div className="snack">{snack}</div> : null}
    </div>
  );
}

function Root() {
  const auth = useAuth();
  if (!auth.ready) return <Bootstrap />;
  if (!auth.authenticated) {
    return (
      <div className="app-shell app-shell--dark">
        <LoginPage />
        <InstallPrompt />
        {auth.error ? <div className="snack">{auth.error}</div> : null}
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
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
