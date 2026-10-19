import { useCallback, useEffect, useState } from 'react';
import SubpageBar from '../components/SubpageBar';
import { notificationsApi } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { readView, writeView } from '../lib/instantView';

export default function NotificationsPage({ onBack, showSnack }) {
  const [items, setItems] = useState(() => readView('notifications') || []);
  const [opened, setOpened] = useState(null);
  const [loading, setLoading] = useState(() => !readView('notifications'));

  const load = useCallback(async () => {
    if (!readView('notifications')) setLoading(true);
    try {
      const res = await notificationsApi.list();
      const rows = res.data || [];
      setItems(rows);
      writeView('notifications', rows);
    } catch (e) {
      if (!readView('notifications')) showSnack(e.message || 'Notifications indisponibles');
    } finally {
      setLoading(false);
    }
  }, [showSnack]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (n) => {
    try {
      const full = await notificationsApi.get(n.id);
      setOpened(full);
      if (!full.isRead) {
        await notificationsApi.markRead(n.id);
        setItems((list) => {
          const next = list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x));
          writeView('notifications', next);
          return next;
        });
      }
    } catch (e) {
      showSnack(e.message || 'Notification indisponible');
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
                onClick={() => open(n)}
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
          {opened ? (
            <div className="catalog-card">
              <div className="catalog-main">
                <strong>{opened.title || 'Notification'}</strong>
                <span>
                  {opened.message || ''}
                  {opened.createdAt ? ` · ${formatDateTime(opened.createdAt)}` : ''}
                </span>
              </div>
              <button type="button" className="link-mini" onClick={() => setOpened(null)}>
                Fermer
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
