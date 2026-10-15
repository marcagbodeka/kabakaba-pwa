import { useEffect, useRef, useState } from 'react';

const DONE_KEY = 'kabakaba_vendor_install_done';
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

export default function InstallPrompt({ appName = 'kabakaba Vendeur' }) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState(null);
  const [deferred, setDeferred] = useState(null);
  const [busy, setBusy] = useState(false);
  const deferredRef = useRef(null);

  useEffect(() => {
    if (isStandalone()) return undefined;
    try {
      if (localStorage.getItem(DONE_KEY) === '1') return undefined;
      if (sessionStorage.getItem(SESSION_KEY) === '1') return undefined;
    } catch {
      /* ignore */
    }

    const onBip = (e) => {
      e.preventDefault();
      deferredRef.current = e;
      setDeferred(e);
      setMode('android');
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    const t = setTimeout(() => {
      if (isStandalone() || deferredRef.current) return;
      if (isIos()) {
        setMode('ios');
        setVisible(true);
      } else {
        setMode('manual');
        setVisible(true);
      }
    }, 1400);

    return () => {
      clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onBip);
    };
  }, []);

  const dismissSession = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const dismissDone = () => {
    setVisible(false);
    try {
      localStorage.setItem(DONE_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const onOk = async () => {
    const evt = deferredRef.current || deferred;
    if (evt) {
      setBusy(true);
      try {
        evt.prompt();
        const choice = await evt.userChoice;
        deferredRef.current = null;
        setDeferred(null);
        if (choice?.outcome === 'accepted') dismissDone();
        else dismissSession();
      } catch {
        dismissSession();
      } finally {
        setBusy(false);
      }
      return;
    }
    dismissDone();
  };

  if (!visible || !mode) return null;

  return (
    <div className="install-backdrop" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <div className="install-sheet">
        <img src="/logo.png" alt="" className="install-logo" width="88" height="88" />
        <h2 id="install-title">Épingler {appName}</h2>
        <p>
          Ajoute l’espace vendeur sur l’écran d’accueil pour l’ouvrir comme une app
          installée, avec le logo kabakaba.
        </p>

        {mode === 'ios' ? (
          <ol className="install-steps">
            <li>
              Appuie sur <strong>Partager</strong> en bas de Safari
            </li>
            <li>
              Choisis <strong>Sur l’écran d’accueil</strong>
            </li>
            <li>
              Valide avec <strong>Ajouter</strong>
            </li>
          </ol>
        ) : null}

        {mode === 'manual' && !deferred ? (
          <p className="install-hint">
            Menu du navigateur → <strong>Installer l’application</strong> ou{' '}
            <strong>Ajouter à l’écran d’accueil</strong>.
          </p>
        ) : null}

        <div className="install-actions">
          <button
            type="button"
            className="btn-action fill accent full"
            disabled={busy}
            onClick={onOk}
          >
            {busy ? 'Ouverture…' : deferred || mode === 'android' ? 'Ok, épingler' : 'Ok'}
          </button>
          <button type="button" className="btn-action outline full" onClick={dismissSession}>
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
