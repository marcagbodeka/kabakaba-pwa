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
        kind === 'NEW_ORDER' ||
        kind === 'ORDER_RING' ||
        kind === 'order_ring' ||
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
    item.kind === 'NEW_ORDER' ||
    item.kind === 'ORDER_RING' ||
    item.kind === 'order_ring' ||
    String(item.kind).startsWith('ORDER_');

  return (
    <div
      className={`push-headsup${urgent ? ' push-headsup--urgent' : ''}`}
      role="alert"
      aria-live="assertive"
      key={item.key}
      onClick={() => setItem(null)}
    >
      <img className="push-headsup-logo" src="/logo.png" alt="" />
      <div className="push-headsup-text">
        <strong>{item.title}</strong>
        {item.body ? <span>{item.body}</span> : null}
      </div>
    </div>
  );
}
