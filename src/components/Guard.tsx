import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePersist } from '../lib/persist';
import { ADMIN_ONLY, MANAGER_UP, PAGE_PERM, anyOn, can, type Grants } from '../lib/perms';
import { useSession } from '../lib/session';
import Icon from './Icon';

const NAMES: Record<string, string> = { users: 'Users & permissions', audit: 'Audit trail', backup: 'Backup & restore', payments: 'Payments', tax: 'Tax & E-VAT', marketing: 'Marketing', settings: 'Settings' };

export function TurnedOff({ title, body, fullscreen, switchAcc }: { title: string; body: string; fullscreen?: boolean; switchAcc?: () => void }) {
  const box = (
    <div role="alert" className="bg-white rounded-4xl shadow-card p-8 flex flex-col items-center text-center gap-3 max-w-lg mx-auto">
      <span className="w-14 h-14 rounded-full bg-canvas flex items-center justify-center"><Icon name="lock" size={24} /></span>
      <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="m-0 text-sm text-sub">{body}</p>
      <div className="flex gap-2 flex-wrap justify-center"><Link to="/" className="btn-primary">Back to Home</Link>{switchAcc && <button onClick={switchAcc} className="btn-ghost">Switch account</button>}</div>
    </div>
  );
  return fullscreen ? <div className="min-h-screen bg-canvas flex items-center justify-center p-4">{box}</div> : <div className="py-10">{box}</div>;
}

/** Shows the page only when the person's role and permissions allow it; otherwise a polite "turned off" screen. */
export default function Guard({ k, children, fullscreen }: { k: string; children: ReactNode; fullscreen?: boolean }) {
  const { session, signOut } = useSession();
  const [grants] = usePersist<Grants>('ecompos.grants', {});
  if (!session || session.role === 'superuser' || session.role === 'developer') return <>{children}</>;
  const first = session.name.split(' ')[0];
  if (ADMIN_ONLY.includes(k)) return <TurnedOff fullscreen={fullscreen} title={`${NAMES[k]} is for the Admin only`} body={`Only the Admin can open ${NAMES[k]}. Ask the Admin if you need something changed here.`} />;
  if (MANAGER_UP.includes(k) && (session.role !== 'manager' || !anyOn(session.role, session.username, grants))) return <TurnedOff fullscreen={fullscreen} title={`${NAMES[k]} is for the Admin and Managers`} body={`${first}, this page is only for the Admin and branch Managers.`} />;
  const rule = PAGE_PERM[k];
  if (rule && !rule[0].some((p) => can(session.role, session.username, p, grants))) return <TurnedOff fullscreen={fullscreen} title={`${rule[1]} is turned off`} body={`The Admin has turned off this permission for ${first}. Ask the Admin to turn it back on, or switch to an account that has it.`} switchAcc={signOut} />;
  return <>{children}</>;
}
