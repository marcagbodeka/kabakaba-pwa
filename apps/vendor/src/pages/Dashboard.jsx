import { useCallback, useEffect, useState } from 'react';
import BottomNav from '../components/BottomNav';
import { notificationsApi, vendorApi } from '../lib/api';
import OrdersPage from './OrdersPage';
import WalletPage from './WalletPage';
import StatsPage from './StatsPage';
import ProfilePage from './ProfilePage';
import CatalogPage from './CatalogPage';
import WithdrawPage from './WithdrawPage';
import HistoryPage from './HistoryPage';
import NotificationsPage from './NotificationsPage';

function CapacityDialog({ current, onClose, onSave, busy }) {
  const [value, setValue] = useState(current || 'OPEN');
  const options = [
    {
      id: 'OPEN',
      title: 'Ouverte',
      sub: 'Accepte les nouvelles commandes immédiates.',
    },
    {
      id: 'BUSY',
      title: 'Occupée',
      sub: 'Plus de commande immédiate. Les programmées restent honorées.',
    },
    {
      id: 'CLOSED',
      title: 'Fermée',
      sub: 'Aucune nouvelle commande, y compris programmée.',
    },
  ];
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Disponibilité de la cantine</h2>
        <p>Tu modifies toi-même ton statut à tout moment.</p>
        <div className="capacity-options">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`capacity-option${value === o.id ? ' active' : ''}`}
              onClick={() => setValue(o.id)}
            >
              <strong>{o.title}</strong>
              <span>{o.sub}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-action fill primary full"
          disabled={busy}
          onClick={() => onSave(value)}
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

export default function Dashboard({ showSnack }) {
  const [tab, setTab] = useState('orders');
  const [stack, setStack] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [capacityOpen, setCapacityOpen] = useState(false);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const loadVendor = useCallback(async () => {
    try {
      const me = await vendorApi.me();
      setVendor(me);
    } catch (e) {
      showSnack(e.message || 'Profil vendeur indisponible');
    } finally {
      setLoading(false);
    }
  }, [showSnack]);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await notificationsApi.list({ limit: 20 });
      setHasUnread((res.data || []).some((n) => !n.isRead));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadVendor();
    refreshUnread();
    const t = setInterval(refreshUnread, 60000);
    return () => clearInterval(t);
  }, [loadVendor, refreshUnread]);

  const openCapacity = () => setCapacityOpen(true);
  const openNotifs = () => setStack('notifications');
  const closeStack = () => setStack(null);

  if (loading && !vendor) {
    return (
      <div className="bootstrap">
        <div className="spinner spinner--light" />
      </div>
    );
  }

  if (stack === 'catalog') {
    return (
      <div className="dashboard">
        <CatalogPage vendor={vendor} onBack={closeStack} showSnack={showSnack} />
      </div>
    );
  }
  if (stack === 'withdraw') {
    return (
      <div className="dashboard">
        <WithdrawPage
          vendor={vendor}
          onBack={closeStack}
          onDone={loadVendor}
          showSnack={showSnack}
        />
      </div>
    );
  }
  if (stack === 'history') {
    return (
      <div className="dashboard">
        <HistoryPage onBack={closeStack} showSnack={showSnack} />
      </div>
    );
  }
  if (stack === 'notifications') {
    return (
      <div className="dashboard">
        <NotificationsPage
          onBack={() => {
            closeStack();
            refreshUnread();
          }}
          showSnack={showSnack}
        />
      </div>
    );
  }

  return (
    <div className="dashboard">
      {tab === 'orders' ? (
        <OrdersPage
          vendor={vendor}
          showSnack={showSnack}
          onCapacityTap={openCapacity}
          onNotificationTap={openNotifs}
          hasUnread={hasUnread}
        />
      ) : null}
      {tab === 'wallet' ? (
        <WalletPage
          vendor={vendor}
          onCapacityTap={openCapacity}
          onNotificationTap={openNotifs}
          hasUnread={hasUnread}
          onWithdraw={() => setStack('withdraw')}
          onHistory={() => setStack('history')}
        />
      ) : null}
      {tab === 'stats' ? (
        <StatsPage
          vendor={vendor}
          onCapacityTap={openCapacity}
          onNotificationTap={openNotifs}
          hasUnread={hasUnread}
          showSnack={showSnack}
        />
      ) : null}
      {tab === 'profile' ? (
        <ProfilePage
          vendor={vendor}
          onCapacityTap={openCapacity}
          onNotificationTap={openNotifs}
          hasUnread={hasUnread}
          onOpenCatalog={() => setStack('catalog')}
          onUpdated={(updated) => setVendor((v) => ({ ...v, ...updated }))}
          onVendorRefresh={loadVendor}
          showSnack={showSnack}
        />
      ) : null}
      <BottomNav current={tab} onChange={setTab} />
      {capacityOpen ? (
        <CapacityDialog
          current={vendor?.capacityStatus}
          busy={savingCapacity}
          onClose={() => setCapacityOpen(false)}
          onSave={async (capacityStatus) => {
            setSavingCapacity(true);
            try {
              const updated = await vendorApi.patchMe({ capacityStatus });
              setVendor((v) => ({ ...v, ...updated }));
              setCapacityOpen(false);
            } catch (e) {
              showSnack(e.message || 'Changement impossible. Réessaie.');
            } finally {
              setSavingCapacity(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
