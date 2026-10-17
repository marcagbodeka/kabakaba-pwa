import { IconCart, IconHome, IconOrders, IconPerson, IconWallet } from './icons';

export default function BottomNav({ current, onChange, cartCount = 0 }) {
  return (
    <div className="bottom-nav-wrap">
      <nav className="bottom-bar" aria-label="Navigation">
        <button
          type="button"
          className={`nav-item${current === 'home' ? ' active' : ''}`}
          onClick={() => onChange('home')}
        >
          <IconHome />
          Accueil
        </button>
        <button
          type="button"
          className={`nav-item${current === 'orders' ? ' active' : ''}`}
          onClick={() => onChange('orders')}
        >
          <IconOrders />
          Commandes
        </button>
        <div className="nav-spacer" />
        <button
          type="button"
          className={`nav-item${current === 'wallet' ? ' active' : ''}`}
          onClick={() => onChange('wallet')}
        >
          <IconWallet />
          Portefeuille
        </button>
        <button
          type="button"
          className={`nav-item${current === 'profile' ? ' active' : ''}`}
          onClick={() => onChange('profile')}
        >
          <IconPerson />
          Profil
        </button>
        <button
          type="button"
          className="cart-fab"
          onClick={() => onChange('cart')}
          aria-label="Panier"
        >
          <IconCart />
          {cartCount > 0 ? <span className="badge">{cartCount > 9 ? '9+' : cartCount}</span> : null}
        </button>
      </nav>
    </div>
  );
}
