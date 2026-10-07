import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import RequireAuthGate from './components/RequireAuthGate';
import { useAuth } from './context/AuthContext';
import { prefetchPlayer } from './services/playerCache';
import { prefetchGameData } from './hooks/useGameData';
import PageMeta from './components/PageMeta';
import HelpFab from './components/HelpFab';
import ErrorBoundary from './components/ErrorBoundary';
import EventSidebar from './components/EventSidebar';
import { PageSkeleton } from './components/Skeleton';

// Eager imports — all pages in the main bundle so route switches are instant
import VaultPage from './pages/VaultPage';
import BuildingsPage from './pages/BuildingsPage';
import WarAcademyPage from './pages/WarAcademyPage';
import MastersPage from './pages/MastersPage';
import WidgetsPage from './pages/WidgetsPage';
import HeroesPage from './pages/HeroesPage';
import HeroGearPage from './pages/HeroGearPage';
import GovGearPage from './pages/GovGearPage';
import GovCharmPage from './pages/GovCharmPage';
import PetsPage from './pages/PetsPage';
import TroopsPage from './pages/TroopsPage';
import MiscPage from './pages/MiscPage';
import ProfilePage from './pages/ProfilePage';

/** Warm game catalogs + player profile as soon as the user is authenticated */
function PrefetchOnBoot() {
  const { user, isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) return;
    // All calculator JSON catalogs into memory + localStorage cache
    prefetchGameData();
    if (user?.gameId) {
      prefetchPlayer().catch(() => {});
    }
  }, [isAuthenticated, user?.gameId]);
  return null;
}

function AppRoutes() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
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
        <PrefetchOnBoot />
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
