/**
 * Onglets section (track indigoLight + pill primary) — parity Flutter SectionTabs.
 */
export default function SectionTabs({ tabs, selectedKey, onSelect }) {
  return (
    <div className="section-tabs" role="tablist">
      {tabs.map((tab) => {
        const active = selectedKey === tab.key;
        const showBadge = tab.badgeCount != null && tab.badgeCount > 0;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`section-tab${active ? ' active' : ''}`}
            onClick={() => onSelect(tab.key)}
          >
            {tab.label}
            {showBadge ? <span className="tab-badge">{tab.badgeCount}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
