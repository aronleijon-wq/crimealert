import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import { Screen, Segmented } from './ui';
import NativeHistory from './NativeHistory';
import StatsTrends from './StatsTrends';

const CrimeAtlas = lazy(() => import('./CrimeAtlas'));

// The website's analysis page, with everything it has (charts, risk, citizen reports, export),
// under "Analys" next to the app's own trends
const Analysis = lazy(() => import('@/pages/Analysis'));

const VIEW_OPTIONS = [{ value: 'trender', label: 'Trender' }, { value: 'atlas', label: 'Atlas' }, { value: 'over-tid', label: 'Över tid' }, { value: 'analys', label: 'Analys' }];

/** Statistik in the iPhone app: the trends where you live, the crime atlas, Sweden over the years, and the full analysis */
const NativeStats = () => {
  useSEO({ title: 'Statistik | CrimeAlert', description: 'Polisens händelser i siffror.', noindex: true });
  const [params, setParams] = useSearchParams();
  const view = VIEW_OPTIONS.some((o) => o.value === params.get('vy')) ? params.get('vy')! : 'trender';
  const setView = (next: string) => { setParams(next === 'trender' ? {} : { vy: next }, { replace: true }); window.dispatchEvent(new Event('ca-tab-top')); };

  return (
    <Screen title="Statistik">
      <div className="mb-2 mt-1"><Segmented options={VIEW_OPTIONS} value={view} onChange={setView} /></div>
      {view === 'atlas' ? (
        <Suspense fallback={<div className="mx-4 mt-6 h-40 animate-pulse rounded-2xl bg-[#1c1c1e]" />}>
          <CrimeAtlas />
        </Suspense>
      ) : view === 'over-tid' ? (
        <NativeHistory />
      ) : view === 'analys' ? (
        <div className="ca-app-analysis">
          <Suspense fallback={<div className="mx-4 mt-6 h-40 animate-pulse rounded-2xl bg-[#1c1c1e]" />}>
            <Analysis />
          </Suspense>
        </div>
      ) : (
        <StatsTrends />
      )}
    </Screen>
  );
};

export default NativeStats;
