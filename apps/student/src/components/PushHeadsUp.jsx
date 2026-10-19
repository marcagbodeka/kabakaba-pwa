import { useEffect, useState } from 'react';

/**
 * Bannière type WhatsApp quand l’app est ouverte (foreground).
 * Chrome n’affiche souvent pas la notif système si l’onglet est focus —
 * on compense avec un slide-in en haut de l’écran.
 */
export default function PushHeadsUp() {
  const [item, setItem] = useState(null);

  useEffect(() => {
    let hideTimer;
    const onPush = (ev) => {
      const { title, body, kind } = ev.detail || {};
      if (!title && !body) return;
      clearTimeout(hideTimer);
      setItem({
        title: title || 'kabakaba',
        body: body || '',
        kind: kind || '',
        key: Date.now(),
      });
      const urgent =
        kind === 'ORDER_READY' ||
        kind === 'ORDER_CANCELLED' ||
        kind === 'NEW_ORDER' ||
        String(kind).startsWith('ORDER_');
      hideTimer = setTimeout(() => setItem(null), urgent ? 7000 : 4500);
    };
    window.addEventListener('kabakaba:push', onPush);
    return () => {
      clearTimeout(hideTimer);
      window.removeEventListener('kabakaba:push', onPush);
    };
  }, []);

  if (!item) return null;

  const urgent =
    item.kind === 'ORDER_READY' ||
    item.kind === 'ORDER_CANCELLED' ||
    item.kind === 'NEW_ORDER' ||
    String(item.kind).startsWith('ORDER_');

  return (
    <div
      className={`push-headsup${urgent ? ' push-headsup--urgent' : ''}`}
      role="alert"
      aria-live="assertive"
      key={item.key}
      onClick={() => setItem(null)}
    >
      <div className="push-headsup-icon" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div className="push-headsup-text">
        <strong>{item.title}</strong>
        {item.body ? <span>{item.body}</span> : null}
      </div>
    </div>
  );
}
