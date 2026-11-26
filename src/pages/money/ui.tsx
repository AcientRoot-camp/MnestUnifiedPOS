import NoticeModal from '../../components/Notice';
import { cx } from '../../lib/format';

export function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={onChange} className={cx('w-12 h-7 rounded-full relative flex-none transition-colors', on ? 'bg-ok' : 'bg-[#cccccc]')}>
      <span className={cx('absolute top-1 w-5 h-5 rounded-full bg-white transition-all', on ? 'left-6' : 'left-1')} />
    </button>
  );
}

export function Head({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex flex-col gap-1 max-w-3xl"><h1 className="m-0 text-[30px] font-medium tracking-tightest">{title}</h1>{sub && <p className="m-0 text-sm text-muted">{sub}</p>}</div>
      {children && <div className="flex gap-2 flex-wrap">{children}</div>}
    </header>
  );
}

export function Msg({ text, onClose }: { text: string; onClose: () => void }) {
  return <NoticeModal msg={text} onClose={onClose} />;
}

export function download(name: string, rows: (string | number)[][]) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }));
  a.download = name;
  a.click();
}
