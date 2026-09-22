import { lazy, Suspense, useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';

const PAGES = [
  lazy(() => import('../pages/VaultPage')),
  lazy(() => import('../pages/BuildingsPage')),
  lazy(() => import('../pages/WarAcademyPage')),
  lazy(() => import('../pages/MastersPage')),
  lazy(() => import('../pages/WidgetsPage')),
  lazy(() => import('../pages/HeroesPage')),
  lazy(() => import('../pages/HeroGearPage')),
  lazy(() => import('../pages/GovGearPage')),
  lazy(() => import('../pages/GovCharmPage')),
  lazy(() => import('../pages/PetsPage')),
  lazy(() => import('../pages/TroopsPage')),
  lazy(() => import('../pages/MiscPage')),
];

export default function EventScoreSync() {
  const { state, loading } = useApp();
  const epoch = Number(state?.settings?.scoreEpoch) || 0;
  const lastEpoch = useRef(epoch);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (lastEpoch.current === epoch) return;
    lastEpoch.current = epoch;
    setSyncing(true);
    const t = setTimeout(() => setSyncing(false), 4000);
    return () => clearTimeout(t);
  }, [epoch, loading]);

  if (!syncing) return null;
  return (
    <div aria-hidden style={{ position: 'fixed', left: -99999, width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
      <Suspense fallback={null}>
        {PAGES.map((Page, i) => (
          <Page key={`score-sync-${epoch}-${i}`} />
        ))}
      </Suspense>
    </div>
  );
}
