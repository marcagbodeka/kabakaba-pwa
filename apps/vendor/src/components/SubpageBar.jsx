import { IconBack } from './icons';

export default function SubpageBar({ title, onBack, action }) {
  return (
    <div className="subpage-bar">
      <button type="button" className="soft-back" onClick={onBack} aria-label="Retour">
        <IconBack />
      </button>
      <h1>{title}</h1>
      <div className="subpage-bar-action">{action || null}</div>
    </div>
  );
}
