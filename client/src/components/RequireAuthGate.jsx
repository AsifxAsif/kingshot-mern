import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Blocks inputs / selects / checkboxes / buttons until logged in.
 * Opens login/register modal on interaction.
 * Does not block Navbar (data-auth-allow) or the auth modal (data-auth-modal).
 */
export default function RequireAuthGate({ children }) {
  const { isAuthenticated, authReady, requireAuth, authOpen } = useAuth();

  // Prompt once auth state is known and user is a guest
  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated && !authOpen) {
      requireAuth('Please login or register to use the calculator');
    }
  }, [authReady, isAuthenticated, authOpen, requireAuth]);

  // Prompt login as soon as we know the user is a guest
  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated && !authOpen) {
      requireAuth('Please login or register first to use the calculator');
    }
  }, [authReady, isAuthenticated, authOpen, requireAuth]);

  useEffect(() => {
    if (!authReady || isAuthenticated) return undefined;

    const isInteractive = (el) => {
      if (!el || el.nodeType !== 1) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return true;
      if (el.isContentEditable) return true;
      if (el.getAttribute?.('role') === 'button') return true;
      return false;
    };

    const insideAuthUi = (el) => {
      if (!el?.closest) return false;
      if (el.closest('[data-auth-modal]')) return true;
      if (el.closest('[data-auth-allow]')) return true;
      return false;
    };

    const block = (e) => {
      if (isAuthenticated) return;
      const t = e.target;
      if (!isInteractive(t) && !t?.closest?.('label')) return;
      const el = isInteractive(t) ? t : t.closest('label');
      if (!el) return;
      if (insideAuthUi(el)) return;

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      if (typeof el.blur === 'function') el.blur();

      if (!authOpen) {
        requireAuth('Please login or register first to use the calculator');
      }
    };

    const opts = { capture: true };
    document.addEventListener('pointerdown', block, opts);
    document.addEventListener('click', block, opts);
    document.addEventListener('focusin', block, opts);
    document.addEventListener('keydown', block, opts);
    document.addEventListener('input', block, opts);
    document.addEventListener('change', block, opts);

    return () => {
      document.removeEventListener('pointerdown', block, opts);
      document.removeEventListener('click', block, opts);
      document.removeEventListener('focusin', block, opts);
      document.removeEventListener('keydown', block, opts);
      document.removeEventListener('input', block, opts);
      document.removeEventListener('change', block, opts);
    };
  }, [isAuthenticated, authReady, requireAuth, authOpen]);

  return children;
}
