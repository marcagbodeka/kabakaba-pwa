import { IconPerson, IconReceipt, IconStats, IconWallet } from './icons';

const ITEMS = [
  { key: 'orders', label: 'Commandes', Icon: IconReceipt },
  { key: 'wallet', label: 'Portefeuille', Icon: IconWallet },
  { key: 'stats', label: 'Stats', Icon: IconStats },
  { key: 'profile', label: 'Profil', Icon: IconPerson },
];

export default function BottomNav({ current, onChange }) {
  return (
    <div className="bottom-nav-wrap">
      <nav className="bottom-nav" aria-label="Navigation principale">
        {ITEMS.map(({ key, label, Icon }) => {
          const active = current === key;
          return (
            <button
              key={key}
              type="button"
              className={`nav-item${active ? ' active' : ''}`}
              onClick={() => onChange(key)}
              aria-current={active ? 'page' : undefined}
            >
              <span className="ico" aria-hidden>
                <Icon />
              </span>
              <span className="nav-label">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
