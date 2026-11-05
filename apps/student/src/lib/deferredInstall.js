export const PWA_INSTALLED_KEY = 'kabakaba_student_pwa_installed';

/** Capture l’événement d’installation avant React, sinon le geste est perdu. */
export function bindDeferredInstall() {
  if (typeof window === 'undefined' || window.__kabakabaInstallBound) return;
  window.__kabakabaInstallBound = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.__kabakabaDeferredInstall = event;
    window.dispatchEvent(new Event('kabakaba:beforeinstallprompt'));
  });

  window.addEventListener('appinstalled', () => {
    window.__kabakabaDeferredInstall = null;
    try {
      localStorage.setItem(PWA_INSTALLED_KEY, '1');
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event('kabakaba:appinstalled'));
  });
}
