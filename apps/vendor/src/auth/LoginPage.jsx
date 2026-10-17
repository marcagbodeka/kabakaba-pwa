import { useState } from 'react';
import { useAuth } from './AuthContext';
import AuthScaffold from '../components/AuthScaffold';
import VendorInput from '../components/VendorInput';
import { PhoneFormatter } from '../lib/format';

export default function LoginPage() {
  const auth = useAuth();
  const [phone, setPhone] = useState(() => {
    if (!auth.phone) return '';
    return PhoneFormatter.formatDisplay(String(auth.phone).replace(/^\+?228/, ''));
  });
  const [pin, setPin] = useState('');

  const onPhoneChange = (raw) => {
    const digits = PhoneFormatter.digitsOf(raw).slice(0, 8);
    setPhone(PhoneFormatter.formatDisplay(digits));
  };

  const canSubmit =
    PhoneFormatter.isValidLocal(phone) &&
    pin.length === auth.pinLength &&
    !auth.isSubmitting &&
    !auth.pinLocked;

  return (
    <AuthScaffold
      showProgress={false}
      showBackButton={false}
      heroIcon={
        <img src="/logo.png" alt="" width="48" height="48" style={{ borderRadius: 14 }} />
      }
      heroTitle="Connexion vendeur"
      heroSubtitle="Saisis ton numéro et ton code PIN pour accéder à ton espace."
    >
      <VendorInput
        label="Téléphone"
        prefix="+228"
        value={phone}
        onChange={onPhoneChange}
        placeholder="90 12 34 56"
        inputMode="numeric"
        autoComplete="tel-national"
      />
      <VendorInput
        label={`Code PIN (${auth.pinLength} chiffres)`}
        value={pin}
        onChange={(v) => {
          auth.clearError();
          setPin(String(v).replace(/\D/g, '').slice(0, auth.pinLength));
        }}
        placeholder={'•'.repeat(auth.pinLength)}
        password
        inputMode="numeric"
        maxLength={auth.pinLength}
        autoComplete="current-password"
      />

      <button
        type="button"
        className="btn-fill"
        disabled={!canSubmit}
        onClick={async () => {
          const ok = await auth.loginWithPin(phone, pin);
          if (!ok) setPin('');
        }}
      >
        {auth.isSubmitting ? 'Connexion…' : 'Se connecter'}
      </button>

      <button type="button" className="auth-switch" onClick={auth.goToActivation}>
        Première connexion ? Activer mon compte
      </button>
    </AuthScaffold>
  );
}
