import { useRef } from 'react';
import '../../styles/register.css';
import { useAuthKeyboard } from '../../lib/useAuthKeyboard';
import { IconArrowLeft, IconArrowRight } from './AuthIcons';

/**
 * Cadre commun des écrans d'inscription : hero (retour, étape, icône, titre,
 * sous-titre, progression) + carte basse. `stepKey` rejoue la transition à
 * chaque changement d'écran et remonte les champs (autofocus propre).
 */
export default function AuthScreen({
  step,
  total = 5,
  icon,
  title,
  subtitle,
  onBack,
  stepKey,
  children,
  footer,
}) {
  const rootRef = useRef(null);
  useAuthKeyboard(rootRef);
  const hasStep = typeof step === 'number';

  return (
    <div className="reg" ref={rootRef}>
      <header className="reg-hero">
        <div className="reg-hero-top">
          {onBack ? (
            <button type="button" className="reg-back" onClick={onBack} aria-label="Retour">
              <IconArrowLeft />
            </button>
          ) : (
            <span />
          )}
          {hasStep ? (
            <div className="reg-pill">
              Étape {step}/{total}
            </div>
          ) : null}
        </div>
        {icon ? (
          <div className="reg-collapse">
            <div className="reg-collapse-in reg-collapse-icon">
              <div className="reg-icon-tile">{icon}</div>
            </div>
          </div>
        ) : null}
        <h1>{title}</h1>
        {subtitle ? (
          <div className="reg-collapse">
            <div className="reg-collapse-in">
              <p>{subtitle}</p>
            </div>
          </div>
        ) : null}
        {hasStep ? (
          <div className="reg-progress" aria-hidden="true">
            <i style={{ width: `${(step / total) * 100}%` }} />
          </div>
        ) : null}
      </header>

      <main className="reg-card">
        <div className="reg-card-inner" key={stepKey ?? step ?? 'single'}>
          {children}
          <div className="reg-spacer" />
          {footer}
        </div>
      </main>
    </div>
  );
}

/** Bouton principal orange, avec flèche optionnelle. */
export function PrimaryButton({ children, arrow = false, ...props }) {
  return (
    <button type="button" className="reg-btn" {...props}>
      {children}
      {arrow ? <IconArrowRight /> : null}
    </button>
  );
}
