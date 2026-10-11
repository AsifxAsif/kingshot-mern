import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <AuthProvider>
          <AppProvider>
            <App />
          </AppProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

/** Register SW and precache the live app shell so offline reload works. */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        try {
          reg.update();
        } catch {
          /* */
        }
        // After control is ready, ask SW to store current page + module scripts
        const precacheShell = () => {
          const urls = new Set(['/', '/index.html', '/manifest.webmanifest']);
          document.querySelectorAll('script[src]').forEach((el) => {
            const s = el.getAttribute('src');
            if (s) urls.add(s);
          });
          document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
            const s = el.getAttribute('href');
            if (s && s.startsWith('/')) urls.add(s);
          });
          // Vite modulepreload
          document.querySelectorAll('link[rel="modulepreload"]').forEach((el) => {
            const s = el.getAttribute('href');
            if (s) urls.add(s);
          });
          const list = [...urls].map((u) => {
            try {
              return new URL(u, window.location.origin).href;
            } catch {
              return null;
            }
          }).filter(Boolean);

          const send = (sw) => {
            if (sw) sw.postMessage({ type: 'PRECACHE', urls: list });
          };
          if (navigator.serviceWorker.controller) {
            send(navigator.serviceWorker.controller);
          } else {
            navigator.serviceWorker.ready.then((r) => send(r.active));
          }
        };

        // Small delay so Vite has injected script tags
        setTimeout(precacheShell, 1500);
        setTimeout(precacheShell, 5000);
      })
      .catch(() => {});
  });
}

registerServiceWorker();
