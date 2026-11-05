import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PWA_INSTALLED_KEY } from '../lib/deferredInstall';

const SESSION_KEY = 'kabakaba_vendor_install_later';

function isStandalone() {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.navigator.standalone === true) return true;
  return false;
}

function isIos() {
  const ua = window.navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

function alreadyInstalled() {
  try {
    return localStorage.getItem(PWA_INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
}

function deferredEvent() {
  return window.__kabakabaDeferredInstall || null;
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const deferredRef = useRef(null);

  useEffect(() => {
    if (isStandalone() || alreadyInstalled()) return undefined;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return undefined;
    } catch {
      /* ignore */
    }

    const markInstalled = () => {
      deferredRef.current = null;
      window.__kabakabaDeferredInstall = null;
      setVisible(false);
      try {
        localStorage.setItem(PWA_INSTALLED_KEY, '1');
      } catch {
        /* ignore */
      }
    };

    const adopt = () => {
      const evt = deferredEvent();
      if (!evt) return;
      deferredRef.current = evt;
      setMode('android');
      setVisible(true);
    };

    adopt();
    window.addEventListener('kabakaba:beforeinstallprompt', adopt);
    window.addEventListener('kabakaba:appinstalled', markInstalled);

    let timer;
    if (isIos() && !deferredEvent()) {
      timer = setTimeout(() => {
        if (isStandalone() || deferredRef.current) return;
        setMode('ios');
        setVisible(true);
      }, 900);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('kabakaba:beforeinstallprompt', adopt);
      window.removeEventListener('kabakaba:appinstalled', markInstalled);
    };
  }, []);

  useLayoutEffect(() => {
    if (!visible) return undefined;
    document.body.classList.add('consent-install-open');
    return () => document.body.classList.remove('consent-install-open');
  }, [visible]);

  const dismissSession = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const onAllow = () => {
    const evt = deferredRef.current || deferredEvent();
    if (!evt || typeof evt.prompt !== 'function') {
      dismissSession();
      return;
    }

    let choice;
    try {
      const result = evt.prompt();
      choice = evt.userChoice || result;
    } catch {
      dismissSession();
      return;
    }

    setBusy(true);
    Promise.resolve(choice)
      .then((answer) => {
        deferredRef.current = null;
        window.__kabakabaDeferredInstall = null;
        if (answer?.outcome === 'accepted') {
          setVisible(false);
          return;
        }
        dismissSession();
      })
      .catch(() => dismissSession())
      .finally(() => setBusy(false));
  };

  if (!visible || !mode) return null;

  return (
    <div className="consent-backdrop" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <div className="consent-sheet">
        <h2 id="install-title">Épingler l’application</h2>
        <p>
          Ajoute l’espace vendeur sur l’écran d’accueil pour l’ouvrir comme une
          application installée, avec le logo kabakaba.
        </p>

        {mode === 'ios' ? (
          <ol className="consent-steps">
            <li>
              Appuie sur <strong>Partager</strong> en bas de Safari.
            </li>
            <li>
              Choisis <strong>Sur l’écran d’accueil</strong>.
            </li>
            <li>
              Valide avec <strong>Ajouter</strong>.
            </li>
          </ol>
        ) : null}

        <div className="consent-actions">
          <button type="button" className="consent-allow" disabled={busy} onClick={onAllow}>
            {busy ? 'Ouverture…' : 'Autoriser'}
          </button>
          <button type="button" className="consent-deny" onClick={dismissSession}>
            Refuser
          </button>
        </div>
      </div>
    </div>
  );
}
