import { useId } from 'react';

/**
 * Champ de la maquette : libellé en capitales + coque 48u (icône, saisie,
 * élément de droite). L'état focus est géré en CSS (:focus-within).
 * `children` reçoit l'id à mettre sur l'input via une fonction.
 */
export function Field({ label, icon, prefix, right, children }) {
  const id = useId();
  return (
    <div className="reg-field">
      <label htmlFor={id}>{label}</label>
      <div className="reg-shell">
        {prefix}
        {icon ? <span className="ic">{icon}</span> : null}
        {children(id)}
        {right}
      </div>
    </div>
  );
}
