import { TogoFlag } from './AuthIcons';

/** Préfixe du champ téléphone : drapeau + indicatif, toujours sur une seule ligne. */
export default function PhonePrefix() {
  return (
    <span className="reg-prefix">
      <TogoFlag />
      +228
    </span>
  );
}
