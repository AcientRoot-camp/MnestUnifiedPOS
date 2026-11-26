import { useEffect, useRef, useState } from 'react';

/** Named events fired when a key changes, so open screens (store, staff, rider) update live. */
const EVENT_OF: Record<string, string> = {
  'ecompos.web2': 'ecompos:web',
  'ecompos.webOrders2': 'ecompos:webOrders',
  'ecompos.collect2': 'ecompos:collect',
  'ecompos.shopUsers': 'ecompos:shopUsers',
  'ecompos.products2': 'ecompos:products',
  'ecompos.stockMoves': 'ecompos:stock',
  'ecompos.apps2': 'ecompos:jobs',
  'ecompos.contactMsgs': 'ecompos:contact',
  // HR time clock (data/clock.ts): a punch fires ecompos:clock; a new gate or badge code fires ecompos:hr.
  'ecompos.clock': 'ecompos:clock',
  'ecompos.gate': 'ecompos:hr',
  'ecompos.hr': 'ecompos:hr',
};

const read = <T,>(key: string, initial: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initial;
  } catch {
    return initial;
  }
};

/** Write a value and tell every open screen that uses the same key. */
export function writeKey(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new CustomEvent('ecompos:persist', { detail: { key } }));
  if (EVENT_OF[key]) window.dispatchEvent(new CustomEvent(EVENT_OF[key]));
}

export const readKey = read;

/**
 * useState that survives reloads via localStorage (falls back silently when storage is blocked).
 * Every component using the same key stays in sync, in this tab and in other tabs.
 */
export function usePersist<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => read(key, initial));
  const last = useRef<string>('');
  useEffect(() => {
    let raw = '';
    try {
      raw = JSON.stringify(v);
    } catch {
      return;
    }
    if (raw === last.current) return;
    last.current = raw;
    let cur: string | null = null;
    try {
      cur = localStorage.getItem(key);
    } catch {
      /* blocked */
    }
    if (cur === raw) return;
    writeKey(key, v);
  }, [key, v]);
  useEffect(() => {
    const sync = () => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(key);
      } catch {
        return;
      }
      if (raw == null || raw === last.current) return;
      try {
        last.current = raw;
        setV(JSON.parse(raw) as T);
      } catch {
        /* bad JSON */
      }
    };
    const onLocal = (e: Event) => {
      if ((e as CustomEvent).detail?.key === key) sync();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) sync();
    };
    window.addEventListener('ecompos:persist', onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('ecompos:persist', onLocal);
      window.removeEventListener('storage', onStorage);
    };
  }, [key]);
  return [v, setV] as const;
}

export const nowTxt = () =>
  new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toTimeString().slice(0, 5);
