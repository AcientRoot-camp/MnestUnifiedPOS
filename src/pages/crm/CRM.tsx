// CRM router: one CRM, role-aware screens (MNestPOS_CRM_Prompt.md §4.3).
import { lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCrm } from './ui';
import type { CrmRole } from './model';
import Overview from './Overview';
import Leads from './Leads';
import Pipeline from './Pipeline';
import Tasks from './Tasks';

const Segments = lazy(() => import('./Segments'));
const Loyalty = lazy(() => import('./Loyalty'));
const Feedback = lazy(() => import('./Feedback'));
const Journeys = lazy(() => import('./Journeys'));
const Team = lazy(() => import('./Team'));
const Settings = lazy(() => import('./Settings'));

/** Which roles have each screen in their menu (§4.3). */
const ALLOW: Record<string, CrmRole[]> = {
  '': ['superuser', 'manager', 'supervisor', 'staff'], leads: ['superuser', 'manager', 'supervisor', 'staff'], pipeline: ['superuser', 'manager', 'supervisor', 'staff'], tasks: ['superuser', 'manager', 'supervisor', 'staff'],
  segments: ['superuser', 'manager', 'supervisor'], loyalty: ['superuser', 'manager', 'supervisor'], feedback: ['superuser', 'manager', 'supervisor', 'staff'],
  journeys: ['superuser', 'manager'], team: ['superuser', 'manager', 'supervisor'], settings: ['superuser'],
};

export default function CRM() {
  const { tab = '' } = useParams();
  const m = useCrm();
  if (!ALLOW[tab]) return <NotHere text="That CRM page does not exist." />;
  if (!ALLOW[tab].includes(m.c.role)) return <NotHere text={tab === 'settings' ? 'CRM settings are for the Admin only.' : 'This part of the CRM is not in your menu. Your Manager or the Admin looks after it.'} />;
  const page = tab === '' ? <Overview m={m} /> : tab === 'leads' ? <Leads m={m} /> : tab === 'pipeline' ? <Pipeline m={m} /> : tab === 'tasks' ? <Tasks m={m} /> : tab === 'segments' ? <Segments m={m} /> : tab === 'loyalty' ? <Loyalty m={m} /> : tab === 'feedback' ? <Feedback m={m} /> : tab === 'journeys' ? <Journeys m={m} /> : tab === 'team' ? <Team m={m} /> : <Settings m={m} />;
  return <Suspense fallback={<div className="flex flex-col gap-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-3xl bg-white/70 animate-pulse" />)}</div>}>{page}</Suspense>;
}

function NotHere({ text }: { text: string }) {
  return (
    <div role="alert" className="bg-white rounded-4xl shadow-card p-8 flex flex-col items-center text-center gap-3 max-w-lg mx-auto mt-6">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
      <h1 className="m-0 text-2xl font-semibold tracking-tight">Not available</h1>
      <p className="m-0 text-sm text-sub">{text}</p>
      <Link to="/crm" className="btn-primary">Back to CRM</Link>
    </div>
  );
}
