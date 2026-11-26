export const ghs = (n: number) =>
  'GHS ' + n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const ghs0 = (n: number) => 'GHS ' + Math.round(n).toLocaleString('en-GH');
export const todayLong = () =>
  new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const timeNow = () => new Date().toTimeString().slice(0, 5);
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
