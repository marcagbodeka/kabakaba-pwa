import { useKeyboardInset } from '../lib/useKeyboardInset';
import { IconBack } from './icons';

export default function AuthScaffold({
  currentStep,
  totalSteps = 3,
  heroIcon,
  heroTitle,
  heroSubtitle,
  showBackButton = true,
  showProgress = true,
  onBack,
  children,
}) {
  useKeyboardInset();
  const hasSteps = showProgress && currentStep != null;
  const progress = hasSteps ? Math.min(1, currentStep / totalSteps) : 0;

  return (
    <div className="auth-scaffold">
      <div className="auth-hero">
        <div className="auth-hero-top">
          {showBackButton ? (
            <button type="button" className="auth-back" onClick={onBack} aria-label="Retour">
              <IconBack />
            </button>
          ) : (
            <div className="auth-back ghost" />
          )}
          {hasSteps ? (
            <div className="auth-pill">
              Étape {currentStep}/{totalSteps}
            </div>
          ) : (
            <div className="auth-pill auth-pill--quiet">Vendeur</div>
          )}
        </div>
        <div className="auth-icon">{heroIcon}</div>
        <h1>{heroTitle}</h1>
        <p>{heroSubtitle}</p>
        {hasSteps ? (
          <div className="auth-progress">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
        ) : null}
      </div>
      <div className="auth-card">{children}</div>
    </div>
  );
}
