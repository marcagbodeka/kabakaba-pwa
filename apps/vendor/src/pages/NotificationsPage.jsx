import { useCallback, useEffect, useState } from 'react';
import SubpageBar from '../components/SubpageBar';
import { notificationsApi } from '../lib/api';
import { formatDateTime } from '../lib/format';

export default function NotificationsPage({ onBack, showSnack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list();
      setItems(res.data || []);
    } catch (e) {
      showSnack(e.message || 'Notifications indisponibles');
    } finally {
      setLoading(false);
    }
  }, [showSnack]);

  useEffect(() => {
    load();
  }, [load]);

  const mark = async (n) => {
    if (n.isRead) return;
    try {
      await notificationsApi.markRead(n.id);
      setItems((list) =>
        list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
      );
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="dashboard-body">
      <SubpageBar title="Notifications" onBack={onBack} />
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="catalog-list">
          {!items.length ? (
            <div className="empty-block">
              <h3>Aucune notification</h3>
              <p>Les alertes commandes et retraits apparaîtront ici.</p>
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`catalog-card notif-card${!n.isRead ? ' unread' : ''}`}
                onClick={() => mark(n)}
              >
                <div className="catalog-main">
                  <strong>{n.title || 'Notification'}</strong>
                  <span>
                    {n.message || ''}
                    {n.createdAt ? ` · ${formatDateTime(n.createdAt)}` : ''}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
