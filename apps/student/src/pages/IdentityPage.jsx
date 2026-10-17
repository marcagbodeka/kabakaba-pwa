import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function IdentityPage() {
  const auth = useAuth();
  const [firstName, setFirstName] = useState(auth.user?.firstName || '');
  const [lastName, setLastName] = useState(auth.user?.lastName || '');

  const submit = async () => {
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      auth.setError('Veuillez remplir tous les champs');
      return;
    }
    try {
      await auth.completeIdentity({ firstName: first, lastName: last });
    } catch {
      /* toast via context */
    }
  };

  return (
    <div className="auth-scaffold">
      <div className="auth-hero">
        <img className="auth-logo" src="/logo.png" alt="" width="56" height="56" />
        <div className="auth-brand">kabakaba</div>
        <h1>Comment t’appelles-tu ?</h1>
        <p>Ces informations créent ton profil étudiant kabakaba.</p>
      </div>
      <div className="auth-card">
        <div className="auth-card-body">
          <div className="field">
            <label>Prénom(s)</label>
            <div className="input-shell">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
                autoComplete="given-name"
                autoCapitalize="words"
                autoFocus
              />
            </div>
          </div>
          <div className="field">
            <label>Nom</label>
            <div className="input-shell">
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
                autoComplete="family-name"
                autoCapitalize="words"
              />
            </div>
          </div>
        </div>
        <div className="auth-card-footer">
          <button
            type="button"
            className="btn-fill"
            disabled={auth.busy || !firstName.trim() || !lastName.trim()}
            onClick={submit}
          >
            {auth.busy ? 'Enregistrement…' : 'Continuer'}
          </button>
        </div>
      </div>
    </div>
  );
}
