import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthScreen, { PrimaryButton } from '../components/auth/AuthScreen';
import { Field } from '../components/auth/Field';
import { IconUser } from '../components/auth/AuthIcons';

/** Compte connecté mais sans prénom/nom : même écran « identité » que l'inscription. */
export default function IdentityPage() {
  const auth = useAuth();
  const [firstName, setFirstName] = useState(auth.user?.firstName || '');
  const [lastName, setLastName] = useState(auth.user?.lastName || '');
  const lastNameRef = useRef(null);
  const valid = Boolean(firstName.trim() && lastName.trim());

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
    <AuthScreen
      icon={<IconUser />}
      title={
        <>
          Comment <span className="reg-nowrap">tu t’appelles ?</span>
        </>
      }
      subtitle="Ces informations créent ton profil étudiant kabakaba."
      footer={
        <PrimaryButton arrow disabled={auth.busy || !valid} onClick={submit}>
          {auth.busy ? 'Enregistrement…' : 'Continuer'}
        </PrimaryButton>
      }
    >
      <Field label="Prénom(s)" icon={<IconUser size={16} />}>
        {(id) => (
          <input
            id={id}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                lastNameRef.current?.focus();
              }
            }}
            placeholder="Prénom"
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="next"
            autoFocus
          />
        )}
      </Field>
      <Field label="Nom" icon={<IconUser size={16} />}>
        {(id) => (
          <input
            id={id}
            ref={lastNameRef}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid && !auth.busy) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Nom"
            autoComplete="family-name"
            autoCapitalize="words"
            enterKeyHint="go"
          />
        )}
      </Field>
    </AuthScreen>
  );
}
