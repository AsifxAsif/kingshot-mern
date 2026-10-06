import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import RequireAuthGate from './components/RequireAuthGate';
import PageMeta from './components/PageMeta';
import HelpFab from './components/HelpFab';
import ErrorBoundary from './components/ErrorBoundary';
import EventSidebar from './components/EventSidebar';
import { PageSkeleton } from './components/Skeleton';

const VaultPage = lazy(() => import('./pages/VaultPage'));
const BuildingsPage = lazy(() => import('./pages/BuildingsPage'));
const WarAcademyPage = lazy(() => import('./pages/WarAcademyPage'));
const MastersPage = lazy(() => import('./pages/MastersPage'));
const WidgetsPage = lazy(() => import('./pages/WidgetsPage'));
const HeroesPage = lazy(() => import('./pages/HeroesPage'));
const HeroGearPage = lazy(() => import('./pages/HeroGearPage'));
const GovGearPage = lazy(() => import('./pages/GovGearPage'));
const GovCharmPage = lazy(() => import('./pages/GovCharmPage'));
const PetsPage = lazy(() => import('./pages/PetsPage'));
const TroopsPage = lazy(() => import('./pages/TroopsPage'));
const MiscPage = lazy(() => import('./pages/MiscPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

function PageFallback() {
  // Light fallback — route chunks are cached after first visit; avoid heavy skeleton flash
  return (
    <div className="page-loading page-loading-lite" aria-busy="true">
      <span className="hint">Loading…</span>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<VaultPage />} />
          <Route path="/buildings" element={<BuildingsPage />} />
          <Route path="/war-academy" element={<WarAcademyPage />} />
          <Route path="/masters" element={<MastersPage />} />
          <Route path="/widgets" element={<WidgetsPage />} />
          <Route path="/heroes" element={<HeroesPage />} />
          <Route path="/hero-gear" element={<HeroGearPage />} />
          <Route path="/gov-gear" element={<GovGearPage />} />
          <Route path="/gov-charm" element={<GovCharmPage />} />
          <Route path="/pets" element={<PetsPage />} />
          <Route path="/troops" element={<TroopsPage />} />
          <Route path="/misc" element={<MiscPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* Fallback so unknown paths still render something */}
          <Route path="*" element={<VaultPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  const { loading, isOnline, sandboxActive, applySandbox, discardSandbox } = useApp();
  // Only block the whole app on the *first* preset load — not on every page switch
  const [bootstrapped, setBootstrapped] = useState(false);
  useEffect(() => {
    if (!loading) setBootstrapped(true);
  }, [loading]);
  const showBootSkeleton = !bootstrapped && loading;

  return (
    <RequireAuthGate>
      <div className="app app-with-events">
        <EventSidebar />
        <Navbar />
        <AuthModal />
        <HelpFab />
        <PageMeta />
        <main className="app-container">
          {!isOnline && (
            <div className="offline-banner" role="status">
              <span className="conn-dot is-offline" />
              Offline — using cached data. Changes save on this device and sync when you are back online.
            </div>
          )}
          {showBootSkeleton ? (
            <div className="page-loading">
              <PageSkeleton cards={4} />
            </div>
          ) : sandboxActive ? (
            <div className="sandbox-shell">
              <div className="sandbox-banner" role="status">
                <strong>Sandbox</strong>
                <span>
                  What-if mode: nothing is saved to your preset until you Apply (levels, vault, everything).
                </span>
                <button type="button" className="preset-btn" onClick={applySandbox}>Apply</button>
                <button type="button" className="preset-btn btn-delete" onClick={discardSandbox}>Discard</button>
              </div>
              <div className="sandbox-body">
                <AppRoutes />
              </div>
            </div>
          ) : (
            <AppRoutes />
          )}
        </main>
      </div>
    </RequireAuthGate>
  );
}
