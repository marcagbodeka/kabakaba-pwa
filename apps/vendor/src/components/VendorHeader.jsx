import { CAPACITY_LABEL, initialsFrom } from '../lib/format';
import { IconBell } from './icons';

export default function VendorHeader({
  vendor,
  showNotification = false,
  hasUnread = false,
  onNotificationTap,
  onCapacityTap,
}) {
  const name = vendor?.canteenName || 'Chargement…';
  const campus = vendor?.campusName || '';
  const capacity = vendor?.capacityStatus || 'CLOSED';
  const initials = initialsFrom(name);
  const chipClass =
    capacity === 'OPEN' ? 'open' : capacity === 'BUSY' ? 'busy' : 'closed';

  return (
    <header className="vheader">
      <div className="vheader-avatar">
        {vendor?.logoUrl ? <img src={vendor.logoUrl} alt="" /> : initials}
      </div>
      <div className="vheader-text">
        <div className="vheader-name">{name}</div>
        {campus ? <div className="vheader-campus">{campus}</div> : null}
      </div>
      {showNotification ? (
        <button
          type="button"
          className="circle-action"
          onClick={onNotificationTap}
          aria-label="Notifications"
        >
          <IconBell />
          {hasUnread ? <span className="dot" /> : null}
        </button>
      ) : null}
      <button
        type="button"
        className={`status-chip ${chipClass}`}
        onClick={onCapacityTap}
      >
        <span className="pip" />
        {CAPACITY_LABEL[capacity] || 'Fermée'}
      </button>
    </header>
  );
}
