import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import LoginPage from './LoginPage';
import RegisterFlow from './RegisterFlow';

/**
 * Point d'entrée non connecté : inscription (maquette) ou connexion par PIN.
 * Un compte avec PIN mémorisé arrive directement sur la connexion.
 */
export default function AuthEntry({ onCreating, onCreateFailed }) {
  const auth = useAuth();
  const startOnLogin = auth.status === 'needsPin' && Boolean(auth.session?.phone);
  const [view, setView] = useState(startOnLogin ? 'login' : 'register');
  const [carry, setCarry] = useState({ phone: '', recovery: false });

  if (view === 'register') {
    return (
      <RegisterFlow
        initialPhone={carry.phone}
        recovery={carry.recovery}
        onCreating={onCreating}
        onCreateFailed={onCreateFailed}
        onLogin={(phone) => {
          setCarry({ phone: phone || '', recovery: false });
          setView('login');
        }}
      />
    );
  }

  return (
    <LoginPage
      initialPhone={carry.phone}
      onBack={
        startOnLogin
          ? undefined
          : (phone) => {
              setCarry({ phone: phone || '', recovery: false });
              setView('register');
            }
      }
      onRegister={(phone, recovery = false) => {
        setCarry({ phone: phone || '', recovery });
        setView('register');
      }}
    />
  );
}
