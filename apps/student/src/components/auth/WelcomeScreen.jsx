import '../../styles/register.css';
import { IconArrowRight, IconSuccessCheck } from './AuthIcons';

/** Écran 6 de la maquette : confirmation de création du compte. */
export default function WelcomeScreen({ firstName, onContinue }) {
  const name = String(firstName || '').trim();
  return (
    <div className="reg">
      <div className="reg-success">
        <div className="reg-success-ring">
          <div className="reg-success-circle">
            <IconSuccessCheck />
          </div>
        </div>
        <h2>{name ? `Bienvenue, ${name}\u00A0!` : 'Bienvenue\u00A0!'}</h2>
        <p>
          Ton compte kabakaba est prêt. Tu peux commander dès maintenant dans les cantines de ton
          campus.
        </p>
      </div>
      <div className="reg-success-bottom">
        <button type="button" className="reg-btn" onClick={onContinue} autoFocus>
          Accéder à mon compte
          <IconArrowRight />
        </button>
      </div>
    </div>
  );
}
