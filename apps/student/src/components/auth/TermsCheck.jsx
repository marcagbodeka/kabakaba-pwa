import { IconCheck } from './AuthIcons';

/**
 * Case « J'accepte les conditions générales ».
 * Le lien ouvre la page des conditions sans toucher à l'état de la case.
 */
export default function TermsCheck({ checked, onChange, onOpenTerms, disabled }) {
  return (
    <label className="reg-check">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="box" aria-hidden="true">
        {checked ? <IconCheck size={13} /> : null}
      </span>
      <span className="txt">
        J’accepte les{' '}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onOpenTerms();
          }}
        >
          conditions générales
        </button>
      </span>
    </label>
  );
}
