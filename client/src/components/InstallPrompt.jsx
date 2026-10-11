import { useEffect, useState } from 'react';

const DISMISS_KEY = 'ks_install_dismissed_v1';

/**
 * Shows "Install app" when the browser fires beforeinstallprompt.
 * Also shows iOS tip when standalone is not active on Safari.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosTip, setIosTip] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* */
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    const onBip = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    // iOS Safari never fires beforeinstallprompt — show manual tip once
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIOS && isSafari) {
      setIosTip(true);
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setDeferred(null);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* */
    }
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* */
    }
    setDeferred(null);
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* */
    }
  };

  if (!visible) return null;

  return (
    <div className="pwa-install-bar" role="status">
      <div className="pwa-install-text">
        {iosTip && !deferred ? (
          <>
            <strong>Add to Home Screen</strong>
            <span>
              Tap Share <span aria-hidden>⬆︎</span> then &quot;Add to Home Screen&quot; to use like an app offline.
            </span>
          </>
        ) : (
          <>
            <strong>Install Kingshot Calc</strong>
            <span>Install for faster access and offline use.</span>
          </>
        )}
      </div>
      <div className="pwa-install-actions">
        {deferred ? (
          <button type="button" className="preset-btn" onClick={install}>
            Install
          </button>
        ) : null}
        <button type="button" className="preset-btn btn-delete" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
