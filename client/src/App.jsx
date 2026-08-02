import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';

const VaultPage = lazy(() => import('./pages/VaultPage'));
const BuildingsPage = lazy(() => import('./pages/BuildingsPage'));
const WarAcademyPage = lazy(() => import('./pages/WarAcademyPage'));
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
  return (
    <div className="page-loading">
      <div className="spinner" />
      <p>Loading…</p>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { loading } = useApp();

  if (loading) {
    return (
      <div className="page-loading full">
        <div className="spinner" />
        <p>Loading from MongoDB...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Navbar />
      <AuthModal />
      <ScrollToTop />
      <main className="app-container">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<VaultPage />} />
            <Route path="/buildings" element={<BuildingsPage />} />
            <Route path="/war-academy" element={<WarAcademyPage />} />
            <Route path="/widgets" element={<WidgetsPage />} />
            <Route path="/heroes" element={<HeroesPage />} />
            <Route path="/hero-gear" element={<HeroGearPage />} />
            <Route path="/gov-gear" element={<GovGearPage />} />
            <Route path="/gov-charm" element={<GovCharmPage />} />
            <Route path="/pets" element={<PetsPage />} />
            <Route path="/troops" element={<TroopsPage />} />
            <Route path="/misc" element={<MiscPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}