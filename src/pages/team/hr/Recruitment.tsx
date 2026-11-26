// People & HR → Recruitment (GTeam.md §4.4): recruitment intelligence, job openings (shared with the online store's
// Careers & opportunities page) with "✨ Write the advert with AI", job applications from the store, and the
// application detail with the stage pipeline: shortlist → interview invitation → AI interview kit and scorecard →
// job offer → AI offer advisor and offer letter → first-week plan → onboarding details → hire (creates the employee,
// staff number, sign-in code and login). Every stage change is logged and messages the candidate by SMS & email.
import { useEffect, useMemo, useState } from 'react';
import { BRS, brName } from '../../../data/catalogue';
import { staffNoOf } from '../../../data/idcard';
import { APPS_KEY, JOB_DOCS, LVNEED, SCORECARD, STAGES, STAGE_LABEL, aiScore, firstWeekPlan, interviewKit, logApp, offerAdvice, offerLetter, seedApps, type JobApp, type Stage } from '../../../data/hr';
import type { Job } from '../../../data/web';
import { readKey, usePersist } from '../../../lib/persist';
import { cx } from '../../../lib/format';
import { bizInfo } from '../../pos/Docs';
import { Card, Pills } from '../../finance/shared';
import { createEmployee, normApp, outbox, toLite, useJobs, type HrData } from './shared';

const ROLES = Object.keys(LVNEED);
const TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'National service'];
const day = (ts: number) => Math.floor((Date.now() - ts) / 864e5);
const stageTone: Record<Stage, string> = { new: 'bg-sky-100 text-sky-900', shortlisted: 'bg-violet-100 text-violet-900', interview: 'bg-amber-100 text-amber-900', offer: 'bg-brand-50 text-brand', hired: 'bg-green-100 text-green-800', rejected: 'bg-[#eee] text-[#666]' };

/** Inputs: HR data, whether the user is the Admin, and the message line. */
export default function Recruitment({ d, admin, say }: { d: HrData; admin: boolean; say: (m: string, err?: boolean) => void }) {
  const { jobs, setJobs } = useJobs();
  const [raw, setRaw] = usePersist<Record<string, unknown>[]>(APPS_KEY, readKey<Record<string, unknown>[] | null>(APPS_KEY, null) || (seedApps(jobs.map(toLite)) as unknown as Record<string, unknown>[]));
  const apps = useMemo(() => raw.map(normApp), [raw]);
  const setApp = (a: JobApp) => setRaw(raw.map((x) => (x.id === a.id ? (a as unknown as Record<string, unknown>) : x)));
  const jobOf = (a: JobApp) => { const j = jobs.find((x) => x.id === a.jobId) || jobs.find((x) => String(a as unknown as { job?: string }).includes(x.title)); return j ? toLite(j) : undefined; };
  const [fJob, setFJob] = useState('all'); const [fSt, setFSt] = useState('progress');
  const [rank, setRank] = useState(true);
  const [sel, setSel] = useState('');
  const [post, setPost] = useState<null | Partial<Job>>(null);
  const list = apps.filter((a) => (fJob === 'all' || a.jobId === fJob) && (fSt === 'all' || (fSt === 'progress' ? !['hired', 'rejected'].includes(a.stage) : a.stage === fSt)))
    .sort((a, b) => (rank ? aiScore(b, jobOf(b)).total - aiScore(a, jobOf(a)).total : b.when - a.when));
  // Intelligence.
  const live = apps.filter((a) => !['hired', 'rejected'].includes(a.stage));
  const waiting = apps.filter((a) => a.stage === 'new' && day(a.when) >= 2);
  const strong = apps.filter((a) => a.stage === 'new' && aiScore(a, jobOf(a)).total >= 75);
  const soon = apps.filter((a) => a.stage === 'interview' && a.interview && (new Date(a.interview.date).getTime() - Date.now()) < 2 * 864e5 && (new Date(a.interview.date).getTime() - Date.now()) > -864e5);
  const avg = apps.length ? Math.round(apps.reduce((s, a) => s + aiScore(a, jobOf(a)).total, 0) / apps.length) : 0;
  const alerts = [
    waiting.length && `⏳ ${waiting.length} new application${waiting.length === 1 ? ' has' : 's have'} waited 2+ days for a decision.`,
    strong.length && `⭐ ${strong.length} strong match${strong.length === 1 ? '' : 'es'} ready to shortlist: ${strong.map((a) => a.name).join(', ')}.`,
    soon.length && `🗓 Interview today or tomorrow: ${soon.map((a) => `${a.name} (${a.interview!.date} ${a.interview!.time})`).join(', ')}.`,
  ].filter(Boolean) as string[];
  const shortlistStrong = () => { const ids = new Set(strong.map((a) => a.id)); setRaw(raw.map((x) => (ids.has(String(x.id)) ? (logApp({ ...normApp(x), stage: 'shortlisted' }, 'Shortlisted (strong AI match)') as unknown as Record<string, unknown>) : x))); strong.forEach((a) => outbox(a.name, 'SMS & email', `Good news: your application for ${jobOf(a)?.title} has been shortlisted.`)); say(`${strong.length} strong matches shortlisted and told by SMS & email`); };
  const a = apps.find((x) => x.id === sel);

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-5 flex flex-col gap-3">
        <div><h2 className="m-0 text-lg font-semibold">✨ Recruitment intelligence</h2><span className="text-xs text-muted">AI scoring and suggestions · always check before deciding</span></div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{([['Open jobs', jobs.filter((j) => j.open && !j.draft).length], ['Applications', apps.length], ['In progress', live.length], ['Average AI score', avg]] as [string, number][]).map(([k, v]) => <div key={k} className="rounded-2xl bg-canvas p-3"><span className="text-xs text-muted block">{k}</span><b className="text-lg">{v}</b></div>)}</div>
        <div className="flex flex-col gap-1.5">{STAGES.filter(([k]) => k !== 'rejected').map(([k, l]) => { const n = apps.filter((x) => x.stage === k).length; return <div key={k} className="flex items-center gap-3 text-sm"><span className="w-28">{l}</span><span className="flex-1 h-2.5 rounded-full bg-canvas overflow-hidden"><span className="block h-full bg-brand" style={{ width: `${(n / Math.max(1, apps.length)) * 100}%` }} /></span><b className="w-8 text-right">{n}</b></div>; })}</div>
        <b className="text-sm">What needs attention</b>
        {alerts.length ? alerts.map((t) => <span key={t} className="text-sm p-2.5 rounded-xl bg-canvas">{t}</span>) : <span className="text-sm text-muted">Nothing waiting. Every application is moving.</span>}
        <div className="flex gap-2 flex-wrap items-center"><label className="text-sm flex items-center gap-2"><input type="checkbox" checked={rank} onChange={() => setRank(!rank)} />Rank by AI score</label>{strong.length > 0 && admin && <button onClick={shortlistStrong} className="btn-dark min-h-9 text-xs">Shortlist all {strong.length} strong matches</button>}</div>
      </section>

      <Card title="Job openings" sub="Live jobs appear on the online store’s Careers & opportunities page, where people apply and upload their CV." actions={<button onClick={() => (admin ? setPost({ title: '', role: 'Sales staff', br: BRS[0].id, type: 'Full-time', salMin: '', salMax: '', openings: 1, closes: '', summary: '', duties: '', reqs: '', offer: '', docs: ['CV / résumé', 'Ghana Card'] }) : say('403 Forbidden · Only the Admin can post jobs.', true))} className="text-sm font-semibold text-brand">+ Post a job opening</button>}>
        {jobs.map((j) => { const n = apps.filter((x) => x.jobId === j.id).length; return (
          <div key={j.id} className="flex items-center gap-3 flex-wrap p-3 rounded-2xl bg-canvas">
            <span className="flex-1 min-w-[200px] text-sm"><b>{j.title}</b><br /><span className="text-xs text-muted">{brName(j.br)} · {j.type} · GHS {j.salMin}–{j.salMax} / month · {j.openings || 1} opening{(j.openings || 1) === 1 ? '' : 's'}{j.closes ? ` · closes ${j.closes}` : ''}</span></span>
            <span className={cx('pill', j.open && !j.draft ? 'bg-green-100 text-green-800' : 'bg-[#eee] text-[#666]')}>{j.open && !j.draft ? 'Open' : 'Closed'}</span>
            <button onClick={() => { setFJob(j.id); setFSt('all'); }} className="text-xs font-semibold underline">Applicants · {n}</button>
            {admin && <button onClick={() => { setJobs((L) => L.map((x) => (x.id === j.id ? { ...x, open: !x.open, draft: false } : x))); say(`${j.title} ${j.open ? 'closed' : 'opened'} on the online store`); }} className="text-xs font-semibold underline">{j.open ? 'Close' : 'Open'}</button>}
          </div>
        ); })}
        {post && <PostJob post={post} setPost={setPost} onPublish={(j) => { setJobs((L) => [{ ...j, id: 'j' + Date.now(), dept: j.role || 'Sales', open: true, apps: 0, draft: false } as Job, ...L]); setPost(null); say(`${j.title} published on the online store’s Careers & opportunities page`); }} say={say} />}
      </Card>

      <Card title="Job applications" sub="Applications from the online store’s Careers & opportunities page. Post jobs here or in Post to webstore → Careers & jobs.">
        <div className="flex gap-2 flex-wrap"><select aria-label="Job" value={fJob} onChange={(e) => setFJob(e.target.value)} className="h-10 px-3.5 rounded-full border border-line text-sm"><option value="all">All jobs</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select>
          <Pills small opts={[['progress', 'In progress'], ['all', 'All'], ...STAGES]} value={fSt} onChange={setFSt} /></div>
        {!apps.length ? <span className="text-sm text-muted">No applications yet. When people apply on the store’s Careers page they appear here.</span> : !list.length ? <span className="text-sm text-muted">No applications match these filters.</span> : null}
        {list.map((x) => { const s = aiScore(x, jobOf(x)); return (
          <button key={x.id} onClick={() => setSel(x.id)} className={cx('flex items-center gap-3 p-3 rounded-2xl border text-left', sel === x.id ? 'border-black bg-canvas' : 'border-line hover:bg-canvas')}>
            <span className="flex-1 min-w-0 text-sm"><b>{x.name}</b><br /><span className="text-xs text-muted">{jobOf(x)?.title || 'Job'} · {x.town || '—'} · {x.exp || 0} yrs · applied {new Date(x.when).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></span>
            <span className="text-xs font-semibold" style={{ color: s.rec[1] }}>✨ {s.total}</span>
            <span className={cx('pill', stageTone[x.stage])}>{STAGE_LABEL[x.stage]}</span>
          </button>
        ); })}
      </Card>
      {a && <Detail key={a.id} d={d} a={a} job={jobOf(a)} admin={admin} setApp={setApp} close={() => setSel('')} say={say} />}
    </div>
  );
}

/** "+ Post a job opening" with "✨ Write the advert with AI". */
function PostJob({ post, setPost, onPublish, say }: { post: Partial<Job>; setPost: (p: Partial<Job> | null) => void; onPublish: (j: Partial<Job>) => void; say: (m: string, err?: boolean) => void }) {
  const set = (p: Partial<Job>) => setPost({ ...post, ...p });
  const inp = 'h-10 px-3.5 rounded-full border border-line text-sm font-normal w-full'; const ta = 'p-3 rounded-2xl border border-line text-sm font-normal w-full';
  /** Draft the advert for the role and branch (summary, duties, requirements, benefits, pay range, documents). */
  const ai = () => {
    const r = post.role || 'Sales staff'; const b = brName(post.br || 'osu'); const pay: Record<string, [number, number]> = { 'Sales staff': [1800, 2400], Supervisor: [2500, 3200], Manager: [3800, 4800], Rider: [1600, 2200], 'Stock clerk': [1800, 2300] };
    const T: Record<string, [string, string, string]> = {
      'Sales staff': [`Join our ${b} showroom selling TVs, fridges, air conditioners and electronics from TCL, Nasco, Samsung and LG.`, 'Welcome customers and help them choose the right product\nSell at the till: cash, MoMo and hire purchase\nKeep displays clean, priced and stocked\nCount stock and report damages', `At least ${LVNEED[r]} year of retail or sales experience\nFriendly, honest and good with numbers\nSpeaks English and Twi\nSHS certificate or higher`],
      Supervisor: [`Lead the sales floor at our ${b} branch and make sure every customer is served well.`, 'Plan shifts and breaks\nApprove refunds and discounts within limits\nCash-up and check the drawers at close\nTrain new sales staff', `${LVNEED[r]}+ years in retail, with some team leading\nCalm with customers and staff\nGood with stock and cash controls`],
      Manager: [`Run our ${b} branch: sales, stock, staff and customers.`, 'Hit monthly sales targets\nManage stock, transfers and damages\nLead and develop the team\nReport to the owner every week', `${LVNEED[r]}+ years managing a shop or branch\nStrong with numbers and reports\nHonest leader who keeps promises`],
      Rider: [`Deliver appliances and electronics to homes and offices around ${b}.`, 'Deliver orders on time and collect cash on delivery safely\nCheck items with the customer on delivery\nKeep the bike and helmet in good condition', `Valid driving licence\n${LVNEED[r]}+ year delivering\nKnows ${b} routes well`],
      'Stock clerk': [`Keep our ${b} store room accurate from delivery to shelf.`, 'Receive deliveries against purchase orders\nRun stock counts and record damages\nPrepare transfers between branches', `${LVNEED[r]}+ year in a warehouse or store room\nCareful and well organised`],
    };
    const [s, du, re] = T[r] || T['Sales staff']; const [lo, hi] = pay[r] || pay['Sales staff'];
    set({ title: post.title || (r === 'Sales staff' ? 'Sales attendant' : r === 'Rider' ? 'Delivery rider' : r), summary: s, duties: du, reqs: re, offer: '18 days paid leave a year\nSSNIT pension\nCommission on sales (1.5%)\nStaff discount on appliances', salMin: String(lo), salMax: String(hi), docs: r === 'Rider' ? ['CV / résumé', 'Ghana Card', 'Driving licence', 'Police report'] : ['CV / résumé', 'Ghana Card', 'Certificates', 'Reference letter'] });
    say('Advert drafted by AI · read and edit anything before publishing');
  };
  const publish = () => {
    if (!post.title?.trim()) return say('Give the job a title.', true);
    if (!post.summary?.trim() || !post.duties?.trim() || !post.reqs?.trim()) return say('Add a summary, duties and requirements, or let AI write them.', true);
    onPublish(post);
  };
  return (
    <div className="rounded-2xl border border-line p-4 flex flex-col gap-3">
      <div className="rounded-2xl bg-brand-50 p-3 flex flex-col gap-2"><b className="text-sm">✨ Write the advert with AI</b><span className="text-xs">Choose the role and branch, then let AI draft the summary, duties, requirements, benefits, salary range and documents. Edit anything before publishing.</span><button onClick={ai} className="btn-dark w-fit min-h-9 text-xs">Write it for me</button></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs font-semibold flex flex-col gap-1">Job title<input value={post.title || ''} onChange={(e) => set({ title: e.target.value })} className={inp} /></label>
        <label className="text-xs font-semibold flex flex-col gap-1">Role<select value={post.role} onChange={(e) => set({ role: e.target.value })} className={inp}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className="text-xs font-semibold flex flex-col gap-1">Branch<select value={post.br} onChange={(e) => set({ br: e.target.value })} className={inp}>{BRS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="text-xs font-semibold flex flex-col gap-1">Type<select value={post.type} onChange={(e) => set({ type: e.target.value })} className={inp}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="text-xs font-semibold flex flex-col gap-1">Pay from (GHS / month)<input value={post.salMin || ''} onChange={(e) => set({ salMin: e.target.value.replace(/[^\d]/g, '') })} className={inp} /></label>
        <label className="text-xs font-semibold flex flex-col gap-1">Pay to (GHS / month)<input value={post.salMax || ''} onChange={(e) => set({ salMax: e.target.value.replace(/[^\d]/g, '') })} className={inp} /></label>
        <label className="text-xs font-semibold flex flex-col gap-1">Openings<input type="number" min={1} value={post.openings || 1} onChange={(e) => set({ openings: parseInt(e.target.value, 10) || 1 })} className={inp} /></label>
        <label className="text-xs font-semibold flex flex-col gap-1">Applications close<input type="date" value={post.closes || ''} onChange={(e) => set({ closes: e.target.value })} className={inp} /></label>
      </div>
      <label className="text-xs font-semibold flex flex-col gap-1">Summary<textarea rows={2} value={post.summary || ''} onChange={(e) => set({ summary: e.target.value })} className={ta} /></label>
      <div className="grid sm:grid-cols-3 gap-3">{([['duties', 'Duties (one per line)'], ['reqs', 'Requirements (one per line)'], ['offer', 'Benefits (one per line)']] as [keyof Job, string][]).map(([k, l]) => <label key={k} className="text-xs font-semibold flex flex-col gap-1">{l}<textarea rows={4} value={String(post[k] || '')} onChange={(e) => set({ [k]: e.target.value })} className={ta} /></label>)}</div>
      <div className="flex flex-col gap-1.5"><span className="text-xs font-semibold">Applicants must upload</span><div className="flex flex-wrap gap-1.5">{JOB_DOCS.map((x) => { const on = (post.docs || []).includes(x); return <button key={x} type="button" aria-pressed={on} onClick={() => set({ docs: on ? (post.docs || []).filter((y) => y !== x) : [...(post.docs || []), x] })} className={cx('h-8 px-3 rounded-full text-xs border', on ? 'bg-black text-white border-black' : 'border-line')}>{x}</button>; })}</div></div>
      <div className="flex gap-2"><button onClick={publish} className="btn-primary">Publish to the online store</button><button onClick={() => setPost(null)} className="btn-ghost">Cancel</button></div>
    </div>
  );
}

/** One application: contact, pipeline, AI match, documents and the actions for its stage. */
function Detail({ d, a, job, admin, setApp, close, say }: { d: HrData; a: JobApp; job: ReturnType<typeof toLite> | undefined; admin: boolean; setApp: (a: JobApp) => void; close: () => void; say: (m: string, err?: boolean) => void }) {
  const s = aiScore(a, job); const role = job?.role || 'Sales staff';
  const [iv, setIv] = useState(a.interview || { date: '', time: '', place: '' });
  const [sc, setSc] = useState<Record<string, number>>(a.scores || {});
  const adv = offerAdvice(a, job);
  const [of, setOf] = useState({ pay: a.offer?.pay ? String(a.offer.pay) : '', start: a.offer?.start || '', contract: a.offer?.contract || 'Same as the advert' });
  const co = bizInfo().name;
  const draft = () => offerLetter(co, a, job, a.offer?.pay || parseFloat(of.pay) || adv.pay, a.offer?.start || of.start, (a.offer?.contract || of.contract) === 'Same as the advert' ? job?.type || 'Full-time' : (a.offer?.contract || of.contract));
  const [letter, setLetter] = useState(a.letter || '');
  useEffect(() => { if (a.stage === 'offer' && !a.letter) setLetter(draft()); }, [a.stage]); // eslint-disable-line react-hooks/exhaustive-deps
  const [onb, setOnb] = useState(a.onb || { card: '', ssnit: '', tin: '', payBy: 'MoMo' as const, acct: '', kin: '', kinPhone: '' });
  const [checks, setChecks] = useState<Record<string, boolean>>(a.checks || {});
  const [why, setWhy] = useState('');
  const tell = (t: string) => outbox(a.name, 'SMS & email', t);
  const move = (stage: Stage, log: string, msg: string, extra: Partial<JobApp> = {}) => { setApp(logApp({ ...a, ...extra, stage }, log)); tell(msg); say(`${a.name}: ${log}`); };
  const avgSc = Object.values(sc).length ? Object.values(sc).reduce((x, y) => x + y, 0) / Object.values(sc).length : 0;
  const CHECKS = ['Contract of employment signed', 'All uploaded documents checked and genuine', 'Ghana Card seen and number recorded', 'SSNIT number recorded', 'MoMo or bank account recorded', 'Next of kin / emergency contact recorded'];
  const hire = () => {
    if (!admin) return say('403 Forbidden · Only the Admin can create employee accounts.', true);
    if (!CHECKS.every((c) => checks[c]) || !a.docs.every((x) => x.verified)) return say('Finish the onboarding checklist and check every document first.', true);
    if (!/^GHA-\d{9}-\d$/.test(onb.card.trim())) return say('Enter the Ghana Card number in the form GHA-123456789-0.', true);
    if (onb.ssnit.trim().length < 5) return say('Enter the SSNIT number.', true);
    if (onb.acct.trim().length < 6) return say('Enter the MoMo or bank account for salary.', true);
    if (onb.kin.trim().length < 3 || onb.kinPhone.replace(/\D/g, '').length < 9) return say('Enter the next of kin name and phone number.', true);
    const { e, login } = createEmployee(d, { name: a.name, title: job?.title || role, phone: a.phone, pay: a.offer?.pay || adv.pay, br: job?.br || BRS[0].id, contract: a.offer?.contract && a.offer.contract !== 'Same as the advert' ? a.offer.contract : job?.type || 'Full-time', email: a.email, level: role === 'Manager' ? 'Manager' : role === 'Supervisor' ? 'Supervisor' : role === 'Rider' ? 'Rider' : 'Sales staff' }, true);
    // Documents and onboarding steps the hire already covered.
    const t = new Date().toISOString().slice(0, 10);
    d.setDocs((D) => ({ ...D, [e.name]: { contract: { state: 'filed', filed: t }, ghcard: { state: 'filed', filed: t, ref: onb.card.trim() }, ssnit: { state: 'filed', filed: t, ref: onb.ssnit.trim() }, ...(onb.tin ? { tin: { state: 'filed', filed: t, ref: onb.tin.trim() } } : {}), bank: { state: 'filed', filed: t, ref: `${onb.payBy} ${onb.acct.trim()}` }, kin: { state: 'filed', filed: t, ref: `${onb.kin} · ${onb.kinPhone}` } } }));
    d.setOnb((M) => ({ ...M, [e.name]: { contract: t, ghcard: t, ssnit: t, ...(onb.tin ? { tin: t } : {}), pay: t, kin: t, login: t } }));
    setApp(logApp({ ...a, onb, checks, stage: 'hired', hired: { empId: e.id, username: login?.username || '', code: login?.passcode || '', no: '' } }, `Hired · account ${login?.username}`));
    tell(`Welcome to ${co}! Sign in at the POS with username ${login?.username}, temporary password ${login?.pw} and passcode ${login?.passcode}. You will choose a new password at first sign-in.`);
    say(`${a.name} hired · now in People and Onboarding`);
  };
  const inp = 'h-10 px-3.5 rounded-full border border-line text-sm font-normal w-full';
  const hiredE = a.hired ? d.E.find((x) => x.id === a.hired!.empId) : undefined;
  return (
    <section className="card p-5 flex flex-col gap-4">
      <div className="flex justify-between gap-3 flex-wrap"><div><button onClick={close} className="text-sm font-semibold">← Applications</button><h2 className="m-0 mt-1 text-xl font-semibold">{a.name}</h2><span className="text-sm text-muted">{job?.title} · {a.phone}{a.email ? ` · ${a.email}` : ''}</span></div><span className={cx('pill h-fit', stageTone[a.stage])}>{STAGE_LABEL[a.stage]}</span></div>
      <ol className="m-0 p-0 list-none flex gap-1.5 flex-wrap">{STAGES.filter(([k]) => k !== 'rejected').map(([k, l], i) => { const idx = STAGES.findIndex(([x]) => x === a.stage); return <li key={k} className={cx('text-xs px-3 py-1.5 rounded-full border', a.stage === 'rejected' ? 'border-line text-muted' : i < idx ? 'bg-black text-white border-black' : i === idx ? 'border-black font-semibold' : 'border-line text-muted')}>{l}</li>; })}</ol>
      <dl className="m-0 grid gap-3 grid-cols-2 lg:grid-cols-4">{([['Lives in', a.town || '—'], ['Experience', `${a.exp || 0} years (needs ${LVNEED[role] ?? 1})`], ['Can start', a.avail || '—'], ['Applied', new Date(a.when).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })]] as [string, string][]).map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="m-0 text-sm font-semibold">{v}</dd></div>)}</dl>
      {a.note && <div className="rounded-2xl bg-canvas p-3 text-sm"><b className="block text-xs text-muted mb-1">Cover note</b>{a.note}</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line p-4 flex flex-col gap-2"><div className="flex justify-between items-center"><b>✨ AI match</b><b className="text-2xl" style={{ color: s.rec[1] }}>{s.total}<span className="text-sm text-muted">/100</span></b></div><span className="text-sm font-semibold" style={{ color: s.rec[1] }}>{s.rec[0]}</span>
          {s.parts.map(([k, v, m]) => <div key={k} className="flex items-center gap-2 text-xs"><span className="w-24">{k}</span><span className="flex-1 h-2 rounded-full bg-canvas overflow-hidden"><span className="block h-full bg-brand" style={{ width: `${(v / m) * 100}%` }} /></span><b className="w-12 text-right">{v}/{m}</b></div>)}
          <b className="text-xs mt-1">Strengths</b>{s.strengths.map((t) => <span key={t} className="text-xs text-ok">✓ {t}</span>)}
          <b className="text-xs mt-1">Gaps to check</b>{s.gaps.map((t) => <span key={t} className="text-xs text-[#b26a00]">! {t}</span>)}</div>
        <div className="rounded-2xl border border-line p-4 flex flex-col gap-2"><b>Documents submitted</b>{a.docs.map((x, i) => <div key={i} className="flex items-center gap-2 text-sm flex-wrap"><span className="flex-1 min-w-[140px]">{x.name}<span className="block text-xs text-muted">{x.file}</span></span><button onClick={() => say(`${x.file} opened`)} className="text-xs underline">Open</button><button onClick={() => { const b = new Blob([`${x.name} from ${a.name}`], { type: 'text/plain' }); const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = x.file; l.click(); }} className="text-xs underline">Download</button><label className="text-xs flex items-center gap-1"><input type="checkbox" checked={!!x.verified} onChange={() => setApp({ ...a, docs: a.docs.map((y, j) => (j === i ? { ...y, verified: !y.verified } : y)) })} />Verified</label></div>)}</div>
      </div>

      {a.stage === 'new' && <div className="flex flex-col gap-2"><b className="text-sm">Next step: shortlist or decline</b><button onClick={() => move('shortlisted', 'Shortlisted', `Good news: your application for ${job?.title} has been shortlisted. We will contact you about an interview.`)} className="btn-primary w-fit">Shortlist</button></div>}
      {a.stage === 'shortlisted' && <div className="rounded-2xl border border-line p-4 flex flex-col gap-2"><b className="text-sm">Invite to an interview</b><div className="grid sm:grid-cols-3 gap-2"><label className="text-xs font-semibold flex flex-col gap-1">Date<input type="date" value={iv.date} onChange={(e) => setIv({ ...iv, date: e.target.value })} className={inp} /></label><label className="text-xs font-semibold flex flex-col gap-1">Time<input type="time" value={iv.time} onChange={(e) => setIv({ ...iv, time: e.target.value })} className={inp} /></label><label className="text-xs font-semibold flex flex-col gap-1">Place<input value={iv.place} onChange={(e) => setIv({ ...iv, place: e.target.value })} placeholder="e.g. Osu branch, ask for the manager" className={inp} /></label></div>
        <button onClick={() => { if (!iv.date || !iv.time || iv.place.trim().length < 3) return say('Set the interview date, time and place.', true); move('interview', `Interview set · ${iv.date} ${iv.time}`, `Interview for ${job?.title} at ${co}: ${iv.date} at ${iv.time}, ${iv.place}. Please bring your Ghana Card.`, { interview: iv }); }} className="btn-primary w-fit">Send interview invitation (SMS & email)</button></div>}
      {a.stage === 'interview' && <>
        <div className="rounded-2xl bg-brand-50 p-4 flex flex-col gap-1.5"><b className="text-sm">✨ AI interview kit</b>{interviewKit(role, s.gaps).map((q, i) => <span key={i} className="text-sm">{i + 1}. {q}</span>)}</div>
        <div className="rounded-2xl border border-line p-4 flex flex-col gap-2"><b className="text-sm">Interview scorecard</b>{SCORECARD.map((c) => <div key={c} className="flex items-center gap-2 text-sm flex-wrap"><span className="flex-1 min-w-[160px]">{c}</span>{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => { const x = { ...sc, [c]: n }; setSc(x); setApp({ ...a, scores: x }); }} className={cx('w-8 h-8 rounded-full text-xs font-semibold border', sc[c] === n ? 'bg-black text-white border-black' : 'border-line')}>{n}</button>)}</div>)}
          {avgSc > 0 && <span className="text-sm">Average <b>{avgSc.toFixed(1)}</b> / 5 · {avgSc >= 4 ? 'Recommend: make an offer' : avgSc >= 3 ? 'Recommend: consider, check references' : 'Recommend: do not offer'}</span>}</div>
        <div className="rounded-2xl border border-line p-4 flex flex-col gap-2"><b className="text-sm">Make a job offer</b><div className="grid sm:grid-cols-3 gap-2"><label className="text-xs font-semibold flex flex-col gap-1">Monthly pay (GHS)<input value={of.pay} onChange={(e) => setOf({ ...of, pay: e.target.value.replace(/[^\d.]/g, '') })} placeholder={String(adv.pay)} className={inp} /></label><label className="text-xs font-semibold flex flex-col gap-1">Start date<input type="date" value={of.start} onChange={(e) => setOf({ ...of, start: e.target.value })} className={inp} /></label><label className="text-xs font-semibold flex flex-col gap-1">Contract<select value={of.contract} onChange={(e) => setOf({ ...of, contract: e.target.value })} className={inp}>{['Same as the advert', ...TYPES].map((t) => <option key={t}>{t}</option>)}</select></label></div>
          <button onClick={() => { const pay = parseFloat(of.pay); if (!(pay > 0)) return say('Enter the monthly pay to offer.', true); if (!of.start) return say('Choose a start date.', true); move('offer', `Offer made · GHS ${pay}`, `Job offer from ${co}: ${job?.title}, GHS ${pay} a month, starting ${of.start}. Your offer letter follows.`, { offer: { pay, start: of.start, contract: of.contract } }); }} className="btn-primary w-fit">Send job offer</button></div>
      </>}
      {a.stage === 'offer' && <>
        <div className="rounded-2xl bg-brand-50 p-4 flex flex-col gap-2"><b className="text-sm">✨ AI offer advisor &amp; offer letter</b><span className="text-sm">Suggested pay: <b>GHS {adv.pay.toLocaleString('en-GB')}</b> · {adv.why}</span>
          <button onClick={() => { setApp({ ...a, offer: { ...(a.offer || { start: '', contract: 'Same as the advert' }), pay: adv.pay } }); setLetter(offerLetter(co, a, job, adv.pay, a.offer?.start || '', a.offer?.contract || 'Same as the advert')); say('Suggested pay used in the offer'); }} className="btn-ghost w-fit min-h-9 text-xs">Use suggested pay in the offer</button>
          <b className="text-xs mt-1">📄 Job offer letter · auto-drafted from the job advert</b>
          <textarea rows={14} value={letter} onChange={(e) => setLetter(e.target.value)} className="p-3 rounded-2xl border border-line text-sm bg-white font-mono leading-5" />
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setApp(logApp({ ...a, letter, letterSent: true }, 'Offer letter sent (SMS & email)')); tell(letter); say('Offer letter sent by SMS & email'); }} className="btn-primary min-h-9 text-xs">📨 Send to candidate (SMS &amp; email)</button>
            <button onClick={() => { const w = window.open('', '_blank'); if (w) { w.document.write(`<pre style="font:14px/1.6 Georgia,serif;white-space:pre-wrap;max-width:680px;margin:40px auto">${letter.replace(/</g, '&lt;')}</pre><script>print()</script>`); w.document.close(); } setApp(logApp({ ...a, letter, letterSent: true }, 'Offer letter printed and marked sent')); }} className="btn-ghost min-h-9 text-xs">🖨 Print for candidate &amp; mark sent</button>
            <button onClick={() => { setApp(logApp({ ...a, letter, letterSent: true }, 'Offer letter marked as sent')); say('Marked as sent'); }} className="btn-ghost min-h-9 text-xs">✓ Mark as sent</button>
            <button onClick={() => { const w = window.open('', '_blank'); if (w) { w.document.write(`<pre style="font:14px/1.6 Georgia,serif;white-space:pre-wrap;max-width:680px;margin:40px auto">${letter.replace(/</g, '&lt;')}</pre><script>print()</script>`); w.document.close(); } }} className="btn-ghost min-h-9 text-xs">Print only</button>
            <button onClick={() => { void navigator.clipboard?.writeText(letter); say('Offer letter copied'); }} className="btn-ghost min-h-9 text-xs">Copy</button>
            <button onClick={() => setLetter(draft())} className="btn-ghost min-h-9 text-xs">Undo my edits</button>
          </div>{a.letterSent && <span className="text-xs text-ok">✓ Offer letter sent</span>}</div>
        <div className="rounded-2xl border border-line p-4 flex flex-col gap-1.5"><b className="text-sm">✨ AI first-week plan</b>{firstWeekPlan(role).map((t) => <span key={t} className="text-sm">{t}</span>)}</div>
        <div className="rounded-2xl border border-line p-4 flex flex-col gap-3"><b className="text-sm">Onboarding · before the first day</b>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="text-xs font-semibold flex flex-col gap-1">Ghana Card number<input value={onb.card} onChange={(e) => setOnb({ ...onb, card: e.target.value.toUpperCase() })} placeholder="GHA-123456789-0" className={inp} /></label>
            <label className="text-xs font-semibold flex flex-col gap-1">SSNIT number<input value={onb.ssnit} onChange={(e) => setOnb({ ...onb, ssnit: e.target.value })} className={inp} /></label>
            <label className="text-xs font-semibold flex flex-col gap-1">TIN (optional)<input value={onb.tin} onChange={(e) => setOnb({ ...onb, tin: e.target.value })} className={inp} /></label>
            <label className="text-xs font-semibold flex flex-col gap-1">Salary paid by<select value={onb.payBy} onChange={(e) => setOnb({ ...onb, payBy: e.target.value as 'MoMo' | 'Bank' })} className={inp}><option>MoMo</option><option>Bank</option></select></label>
            <label className="text-xs font-semibold flex flex-col gap-1">MoMo number or bank account<input value={onb.acct} onChange={(e) => setOnb({ ...onb, acct: e.target.value })} className={inp} /></label>
            <label className="text-xs font-semibold flex flex-col gap-1">Next of kin<input value={onb.kin} onChange={(e) => setOnb({ ...onb, kin: e.target.value })} className={inp} /></label>
            <label className="text-xs font-semibold flex flex-col gap-1">Next of kin phone<input value={onb.kinPhone} onChange={(e) => setOnb({ ...onb, kinPhone: e.target.value })} className={inp} /></label>
          </div>
          <button onClick={() => { setApp({ ...a, onb, checks }); say('Onboarding details saved'); }} className="btn-ghost w-fit">Save details</button>
          <div className="flex flex-col gap-1.5">{CHECKS.map((c) => <label key={c} className="text-sm flex items-center gap-2"><input type="checkbox" checked={!!checks[c]} onChange={() => { const x = { ...checks, [c]: !checks[c] }; setChecks(x); setApp({ ...a, onb, checks: x }); }} />{c}</label>)}</div>
          <button onClick={hire} className="btn-primary w-fit">Hire and create employee account</button></div>
      </>}
      {a.stage === 'hired' && <div className="rounded-2xl bg-green-50 p-4 flex flex-col gap-1 text-sm"><b className="text-green-800">✓ Hired · now in People and Onboarding</b><span>Username: <b>{a.hired?.username}</b>{hiredE ? <> · staff number <b>{staffNoOf(hiredE)}</b></> : null}</span><span className="text-xs text-muted">A welcome SMS and email with the sign-in details went to the new employee.</span></div>}
      {a.stage === 'rejected' && <div className="flex flex-col gap-2"><span className="text-sm">Not selected.{a.reason ? <span className="text-muted"> · {a.reason}</span> : null}</span><button onClick={() => move('new', 'Application reopened', `Your application for ${job?.title} is being looked at again.`)} className="btn-ghost w-fit">Reopen application</button></div>}
      {!['hired', 'rejected'].includes(a.stage) && <div className="flex gap-2 flex-wrap items-center border-t border-line pt-3"><input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason (kept private)" className="h-10 px-3.5 rounded-full border border-line text-sm flex-1 min-w-[200px]" /><button onClick={() => move('rejected', `Not selected${why ? ` · ${why}` : ''}`, `Thank you for applying for ${job?.title} at ${co}. This time we have chosen another candidate. We wish you well.`, { reason: why })} className="h-10 px-4 rounded-full border border-danger text-danger text-sm font-semibold">Not selected</button></div>}
      <div className="flex flex-col gap-1"><b className="text-sm">History</b>{(a.history || []).map((h, i) => <span key={i} className="text-xs text-muted">{h.at} · {h.t}</span>)}</div>
    </section>
  );
}
