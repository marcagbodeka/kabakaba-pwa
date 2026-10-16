import { useKeyboardInset } from '../lib/useKeyboardInset';
import { IconBack } from './icons';

export default function AuthScaffold({
  currentStep,
  totalSteps = 3,
  heroIcon,
  heroTitle,
  heroSubtitle,
  showBackButton = true,
  onBack,
  children,
}) {
  useKeyboardInset();
  const progress = Math.min(1, currentStep / totalSteps);

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
          <div className="auth-pill">
            Étape {currentStep}/{totalSteps}
          </div>
        </div>
        <div className="auth-icon">{heroIcon}</div>
        <h1>{heroTitle}</h1>
        <p>{heroSubtitle}</p>
        <div className="auth-progress">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <div className="auth-card">{children}</div>
    </div>
  );
}
