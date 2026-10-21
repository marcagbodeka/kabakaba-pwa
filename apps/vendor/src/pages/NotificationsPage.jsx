import { useCallback, useEffect, useMemo, useState } from 'react';
import SubpageBar from '../components/SubpageBar';
import { notificationsApi } from '../lib/api';
import { dayOffset, formatDateTime } from '../lib/format';
import { readView, writeView } from '../lib/instantView';

export default function NotificationsPage({ onBack, showSnack }) {
  const [items, setItems] = useState(() => readView('notifications') || []);
  const [opened, setOpened] = useState(null);
  const [day, setDay] = useState(0);
  const [loading, setLoading] = useState(() => !readView('notifications'));
  const visible = useMemo(
    () => items.filter((n) => dayOffset(n.createdAt) === day).slice(0, 20),
    [items, day],
  );

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
      <div className="section-tabs">
        {['Aujourd’hui', 'Hier'].map((label, i) => (
          <button
            key={label}
            type="button"
            className={`section-tab${day === i ? ' active' : ''}`}
            onClick={() => setDay(i)}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="catalog-list catalog-list--inset">
          {!visible.length ? (
            <div className="empty-block">
              <h3>{day === 0 ? 'Rien aujourd’hui' : 'Rien hier'}</h3>
              <p>Les alertes plus anciennes ne s’affichent plus.</p>
            </div>
          ) : (
            visible.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`notif-card${!n.isRead ? ' unread' : ''}`}
                onClick={() => open(n)}
              >
                <strong>{n.title || 'Notification'}</strong>
                <span>
                  {String(n.message || '').replace(
                    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
                    '',
                  )}
                  {n.createdAt ? ` · ${formatDateTime(n.createdAt)}` : ''}
                </span>
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
