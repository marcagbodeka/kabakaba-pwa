import { IconBack } from './icons';

export default function SubpageBar({ title, eyebrow, onBack, action }) {
  return (
    <header className="sp-hero">
      <div className="sp-hero-row">
        <button type="button" className="soft-back soft-back--on-dark" onClick={onBack} aria-label="Retour">
          <IconBack />
        </button>
        <div className="sp-hero-copy">
          {eyebrow ? <p className="sp-hero-kicker">{eyebrow}</p> : null}
          <h1>{title}</h1>
        </div>
        <div className="sp-hero-side">{action || <span className="sp-hero-side-spacer" />}</div>
      </div>
    </header>
  );
}
