import { useState } from 'react';
import '../../styles/register.css';
import { IconArrowRight, IconDoc, IconSuccessCheck } from './AuthIcons';
import TermsCheck from './TermsCheck';

/** Écran de fin d'inscription : bienvenue + acceptation des CGU. */
export default function WelcomeScreen({ firstName, onContinue }) {
  const name = String(firstName || '').trim();
  const [accepted, setAccepted] = useState(false);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);

  const continueIn = async () => {
    if (!accepted || busy) return;
    setBusy(true);
    try {
      await onContinue();
    } finally {
      setBusy(false);
    }
  };

  if (reading) {
    return (
      <div className="reg">
        <div className="reg-success">
          <div className="reg-success-ring">
            <div className="reg-success-circle">
              <IconDoc />
            </div>
          </div>
          <h2>Conditions générales</h2>
          <p>Le contenu sera publié prochainement.</p>
        </div>
        <div className="reg-success-bottom">
          <button type="button" className="reg-btn" onClick={() => setReading(false)}>
            Retour
          </button>
        </div>
      </div>
    );
  }

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
        <TermsCheck
          checked={accepted}
          onChange={setAccepted}
          onOpenTerms={() => setReading(true)}
          disabled={busy}
        />
        <button
          type="button"
          className="reg-btn"
          disabled={!accepted || busy}
          onClick={continueIn}
        >
          {busy ? 'Enregistrement…' : 'Accéder à mon compte'}
          {busy ? null : <IconArrowRight />}
        </button>
      </div>
    </div>
  );
}
