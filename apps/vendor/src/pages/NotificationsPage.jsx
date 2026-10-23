import { useCallback, useEffect, useMemo, useState } from 'react';
import SubpageBar from '../components/SubpageBar';
import { IconBell } from '../components/icons';
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
      <SubpageBar title="Notifications" eyebrow="Alertes" onBack={onBack} />
      <div className="sheet-body sheet-body--sub">
        <div className="day-pills" style={{ marginBottom: 14 }}>
          {['Aujourd’hui', 'Hier'].map((label, i) => (
            <button
              key={label}
              type="button"
              className={`day-pill${day === i ? ' on' : ''}`}
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
          <div className="sub-scroll catalog-list">
            {!visible.length ? (
              <div className="empty-block">
                <div className="empty-nest">
                  <div className="empty-nest-inner">
                    <IconBell size={22} />
                  </div>
                </div>
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
          </div>
        )}
      </div>

      {opened ? (
        <div className="sheet-backdrop" onClick={() => setOpened(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{opened.title || 'Notification'}</h2>
            <p className="sub">
              {opened.message || ''}
              {opened.createdAt ? ` · ${formatDateTime(opened.createdAt)}` : ''}
            </p>
            <button type="button" className="btn-action fill primary full" onClick={() => setOpened(null)}>
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
