import { CAPACITY_LABEL, initialsFrom } from '../lib/format';
import { IconBell } from './icons';

/**
 * Hero indigo type étudiant — identité cantine + capacité + notifs.
 */
export default function VendorHeader({
  vendor,
  showNotification = false,
  hasUnread = false,
  onNotificationTap,
  onCapacityTap,
  showCapacity = true,
  eyebrow = 'Espace vendeur',
  compact = false,
  liveCount = null,
}) {
  const name = vendor?.canteenName || 'Chargement…';
  const campus = vendor?.campusName || '';
  const capacity = vendor?.capacityStatus || 'CLOSED';
  const initials = initialsFrom(name);
  const chipClass =
    capacity === 'OPEN' ? 'open' : capacity === 'BUSY' ? 'busy' : 'closed';

  return (
    <header className={`vhero${compact ? ' vhero--compact' : ''}`}>
      <div className="vhero-top">
        <div className="vhero-identity">
          <div className="vhero-avatar">
            {vendor?.logoUrl ? <img src={vendor.logoUrl} alt="" /> : initials}
          </div>
          <div className="vhero-text">
            <div className="vhero-eyebrow">
              {liveCount != null && liveCount > 0 ? (
                <span className="vhero-live">
                  <span className="vhero-live-pip" />
                  {liveCount} en cours
                </span>
              ) : (
                eyebrow
              )}
            </div>
            <div className="vhero-name">{name}</div>
            {campus ? <div className="vhero-campus">{campus}</div> : null}
          </div>
        </div>
        <div className="vhero-actions">
          {showNotification ? (
            <button
              type="button"
              className={`vhero-icon-btn${hasUnread ? ' alert' : ''}`}
              onClick={onNotificationTap}
              aria-label="Notifications"
            >
              <IconBell />
              {hasUnread ? <span className="dot" /> : null}
            </button>
          ) : null}
          {showCapacity ? (
            <button
              type="button"
              className={`vhero-chip ${chipClass}`}
              onClick={onCapacityTap}
            >
              <span className="pip" />
              {CAPACITY_LABEL[capacity] || 'Fermée'}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
